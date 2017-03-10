Ext.define("TSInitiativePercentageView", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: 'border',
    
    items: [
        {xtype:'container',itemId:'selector_box',region: 'north', layout: 'hbox', defaults: { margin: 10 }},
        {xtype:'container',itemId:'display_box', region: 'center', layout: 'fit'}
    ],

    integrationHeaders : {
        name : "TSInitiativePercentageReport"
    },
    
    config: {
        defaultSettings: {
            initiativeFieldValues: []
        }
    },
    
    launch: function() {
        var me = this;
//        console.log('subadmin:', this.getContext().getPermissions().isSubscriptionAdmin());
//        console.log('wsadmin:',  this.getContext().getPermissions().isWorkspaceAdmin());
//        console.log('eitheradmin:',  this.getContext().getPermissions().isWorkspaceOrSubscriptionAdmin());
//        if ( !this.getContext().getPermissions().isWorkspaceOrSubscriptionAdmin() ) {
//            this._showAppMessage("You must be a workspace or subscription admin to use this app.");
//            return;
//        }
        
        CA.agile.technicalservices.util.WsapiUtils.getPortfolioItemTypes().then({
            success: function(pis) {
                this.PortfolioItemTypes = pis;
                this._addSelectors();
            },
            scope: this
        });
    },
    
    _getMonthData: function() {
        var month_data = [];
        var current_date = new Date();
        
        for ( var i=0; i<14; i++ ) {
            var month_iso = Ext.Date.format(current_date, 'Y-m');
            month_data.push({name:month_iso,value:month_iso + '-01'});
            current_date = Rally.util.DateTime.add(current_date,'month',-1);
        }
        
        return month_data;
    },
    
    _addSelectors: function() {
        var me = this,
            container = this.getSelectorBox();
    
        container.add({
            xtype:'combo',
            store: Ext.create('Ext.data.Store',{
                fields: ['name','value'],
                data: this._getMonthData()
            }),
            fieldLabel: 'From',
            labelWidth: 45,
            displayField: 'name',
            valueField: 'value',
            typeAhead: false,
            queryMode: 'local'
        }).on(
            'change', 
            function(cb) {
                this.selectedStart = cb.getValue();
                this._updateData();
            }, 
            me
        );
        
        container.add({
            xtype:'combo',
            store: Ext.create('Ext.data.Store',{
                fields: ['name','value'],
                data: this._getMonthData()
            }),
            fieldLabel: 'Through',
            labelWidth: 45,
            displayField: 'name',
            valueField: 'value',
            typeAhead: false,
            queryMode: 'local'
        }).on(
            'change', 
            function(cb) {
                this.selectedEnd = cb.getValue();
                this._updateData();
            }, 
            me
        );
        
        container.add({xtype:'container',flex: 1});
        
        container.add({
            xtype:'rallybutton',
            itemId:'export_button',
            cls: 'secondary',
            text: '<span class="icon-export"> </span>',
            disabled: true,
            listeners: {
                scope: this,
                click: this._export
            }
        });
        
    },
    
    _updateData: function() {
        var me = this;
        
        this._clearDisplayBox();
        this.logger.log('starting:', this.selectedStart, this.selectedEnd);
        
        if ( Ext.isEmpty(this.selectedStart) || Ext.isEmpty(this.selectedEnd) ) {
            return;
        }
        
        if ( this.selectedStart > this.selectedEnd ) { 
            var holder = this.selectedStart;
            this.selectedStart = this.selectedEnd;
            this.selectedEnd = holder;
        }
        
        this.logger.log('using start/end', this.selectedStart, this.selectedEnd);

        this.projectsForArtifactOid = {};
        
        Deft.Chain.pipeline([
            this._fetchCandidateInitiatives,
            this._fetchActiveStoryHierarchies,
            this._fetchInitiativesFromHierarchies,
            this._fetchAlreadyEnteredData
        ],this).then({
            success: function(results) {
                var initiatives = results[0],
                    prefs_by_oid = results[1];
                
                this.logger.log("prefs by oid:", prefs_by_oid);
                this.logger.log("projects by oid:", this.projectsForArtifactOid);
                
                var initiative_data = Ext.Array.map(initiatives, function(initiative) {
                    return initiative.getData();
                });
                
                // need to have a row for each initiative for each project it is in
                var final_models = [];
                
                // need to make a column for each of the preference months
                var months = this._getArrayOfMonthsFromSelected();
                
                Ext.Array.each(initiative_data, function(initiative){
                    var oid = initiative.ObjectID;
                    
                    initiative.__prefValues = {};
                    Ext.Array.each(months, function(month) {
                        initiative.__prefValues[month] = null;
                    });
                    
                    Ext.Object.each(this.projectsForArtifactOid[oid], function(project_oid, project){
                        var clone = Ext.clone(initiative);
                        clone.Team = project;
                        
                        Ext.Array.each(prefs_by_oid[oid], function(pref){
                            if ( pref.get('Project')._refObjectName == project.Name ) {
                                var pref_month = this._getPrefMonthFromKey(pref.get('Name'));
                                clone.__prefValues[pref_month] = pref.get("Value");
                                clone.__pref = pref;
                            }
                        },this);
                        final_models.push(clone);
                    },this);
                    
                },this);
                
                this.displayGrid(final_models);
            },
            failure: function(msg) {
                
                if ( Ext.isString(msg) ) {
                    this.showErrorNotification( msg );
                    return;
                }
                if ( Ext.isObject(msg) && !Ext.isEmpty(msg.msg) ) {
                    this._showAppMessage(msg.msg);
                }
            },
            scope: this
        }).always(function() { me.setLoading(false); });
    },
    
    /*
     * Only initiatives that matched a particular value during the month
     * 
     * Because of the large number of stories and changes to stories potentially available, 
     * need to limit the query early.
     */
    _fetchCandidateInitiatives: function() {
        this.setLoading("Finding candidate initiatives...");

        var initiative_filters = this.getSetting('initiativeFieldValues'),
            deferred = Ext.create('Deft.Deferred');
        
        if ( Ext.isString(initiative_filters) ) {
            initiative_filters = Ext.JSON.decode(initiative_filters);
        }
        var month_start = this.selectedStart;
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(this.selectedEnd), 'month', 1
            )
        );

        var filters = Ext.create('Rally.data.lookback.QueryFilter',{property:'_TypeHierarchy', operator:'in', value:[this.PortfolioItemTypes[1].get('TypePath')]});
        
        if ( !Ext.isEmpty(initiative_filters) ) {
            filters = filters.and(
                Ext.create('Rally.data.lookback.QueryFilter',{property:'_ValidTo', operator:'>=', value:month_start})
            );
        
            filters = filters.and(
                Ext.create('Rally.data.lookback.QueryFilter',{property:'_ValidFrom', operator:'<', value:next_month})
            );
            
            var filterized_initiative_filters = Rally.data.lookback.QueryFilter.and(initiative_filters);
            filters = filters.and(filterized_initiative_filters);
        } else {
            filters = filters.and(Ext.create('Rally.data.lookback.QueryFilter',{property:'__At', value: 'current'}));
        }
        
        var config = {
            filters: filters,
            fetch: ['ObjectID','FormattedID','Name'],
            limit: Infinity,
            compress: true
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config).then({
            scope: this,
            success: function(snapshots) {
                this.logger.log('candidate initiative snapshots:', snapshots.length);
                
                if ( snapshots.length === 0 ) {
                    deferred.reject({msg: 'No initiatives meet the filters.'});
                    return;
                }
                
                var snaps_by_oid = {};
                Ext.Array.each(snapshots, function(snapshot){
                    snaps_by_oid[snapshot.get('ObjectID')] = snapshot;
                });
                
                this.initiative_snaps_by_oid = snaps_by_oid;
                
                deferred.resolve( Ext.Object.getValues(snaps_by_oid) );
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _fetchActiveStoryHierarchies: function(initiative_snapshots) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        this.setLoading("Finding appropriate stories...");
        
        Deft.Chain.parallel([
            function() { return me._fetchStoryChangeSnapshots(initiative_snapshots); },
            function() { return me._fetchStoryStartSnapshots(initiative_snapshots); }
        ],this).then({
            scope: this,
            success: function(results) {
                var snapshots = Ext.Array.push(results[0],results[1]);
                this.logger.log("Got story snapshots:", snapshots.length);
                if ( snapshots.length === 0 ) {
                    deferred.reject({msg: 'There were no active stories in the time period.'});
                    return;
                }
                var hierarchies = {};
                
                Ext.Array.map(snapshots, function(snapshot){
                    hierarchies[snapshot.get('ObjectID')] = snapshot.get('_ItemHierarchy');
                    var project = snapshot.get('Project');
                    
                    Ext.Array.each(snapshot.get('_ItemHierarchy'), function(oid) {
                        if ( Ext.isEmpty(me.projectsForArtifactOid[oid])) {
                            me.projectsForArtifactOid[oid] = { };
                        }
                        me.projectsForArtifactOid[oid][project.ObjectID] = project;
                    });
                });
                
                deferred.resolve( Ext.Object.getValues(hierarchies) );
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _fetchStoryChangeSnapshots: function(initiative_snapshots) {
        var month_start = this.selectedStart;
        
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(this.selectedEnd), 'month', 1
            )
        );
        
        //
        var active_states = ['Defined','In-Progress','Completed'];
        var valid_types = [null,'Standard'];
        var initiative_oids = Ext.Array.map(initiative_snapshots || [], function(snap){ return snap.get('ObjectID'); });
        
        this.logger.log('initiative count', initiative_oids.length);
        
        var config = {
            find: {
                "_ItemHierarchy": { "$in": initiative_oids },
                _TypeHierarchy: { "$in": ['HierarchicalRequirement'] },
                "Children": null,
                "c_StoryType": { "$in": valid_types },
                "ScheduleState": { "$in":  active_states },
                "_PreviousValues.ScheduleState": { "$exists": true },
                "_ValidFrom": {
                    "$lt":  next_month
                },
                "_ValidTo": { 
                    "$gt": month_start
                }
            },
            fetch: ['ObjectID','_ItemHierarchy','Project','_ValidTo','_ValidFrom'],
            hydrate: ['Project'],
            useHttpPost: true,
            limit: Infinity
        };
        
        return CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config);
    },
        
    _fetchStoryStartSnapshots: function(initiative_snapshots) {
        var month_start = this.selectedStart;
        
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(this.selectedEnd), 'month', 1
            )
        );
        
        //
        var active_states = ['Defined','In-Progress','Completed'];
        var valid_types = [null,'Standard'];
        var initiative_oids = Ext.Array.map(initiative_snapshots || [], function(snap){ return snap.get('ObjectID'); });
        
        this.logger.log('initiative count', initiative_oids.length);
        
        var config = {
            find: {
                "_ItemHierarchy": { "$in": initiative_oids },
                _TypeHierarchy: { "$in": ['HierarchicalRequirement'] },
                "Children": null,
                "c_StoryType": { "$in": valid_types },
                "ScheduleState": { "$in":  active_states },
                "__At": month_start
            },
            fetch: ['ObjectID','_ItemHierarchy','Project','_ValidTo','_ValidFrom'],
            hydrate: ['Project'],
            useHttpPost: true,
            limit: Infinity
        };
        
        return CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config);
    },
    
    _fetchInitiativesFromHierarchies: function(hierarchies) {
        this.logger.log('_fetchInitiativesFromHierarchies',hierarchies.length);

        if ( hierarchies.length === 0 ) { return []; }
        return Ext.Object.getValues(this.initiative_snaps_by_oid);
        
//        this.setLoading("Finding associated initiatives...");
//
//        var oids = [];
//        Ext.Array.each(hierarchies, function(hierarchy){
//            hierarchy.pop();
//            oids = Ext.Array.push(oids,hierarchy);
//        });
//        
//        oids = Ext.Array.unique(oids);
//        this.logger.log("Searching for this many PI oids:", oids.length);
//        
//        var filter_array =  [];
//        Ext.Array.each(oids, function(oid){
//            filter_array.push({ property:'ObjectID',value:oid });
//        });
//        
//        this.logger.log('Got array');
//        var filters = Rally.data.wsapi.Filter.or( filter_array );
//        
//        this.logger.log('Got filter');
//        
//        if ( Ext.isEmpty(filters) ) { return []; }
//        
//        var base_filter = this.getBaseInitiativeFilter();
//        if ( !Ext.isEmpty(base_filter) ) {
//            filters = filters.and(base_filter);
//        }
//        
//        this.logger.log('-- here');
//        this.logger.log('--', this.PortfolioItemTypes[1].get('TypePath'));
//
//        var config = {
//            model: this.PortfolioItemTypes[1].get('TypePath'),
//            filters: filters,
//            fetch: ['FormattedID','Name'],
//            enablePostGet: true,
//            context: { project: null }
//        };
//         
//        this.logger.log('config:', config);
//        return CA.agile.technicalservices.util.WsapiUtils.loadWsapiRecords(config);
    },
    

    
    _fetchAlreadyEnteredDataForMonth: function(month_start,key_prefix) {
        this.logger.log('_fetchAlreadyEnteredDataForMonth', month_start, key_prefix);
        var config = {
            model: 'Preference',
            fetch: ['Name','Value','Project'],
            filters: [
                {property:'Name',operator:'contains',value: key_prefix + "." + month_start}
            ],
            pageSize: 2000,
            context: { project: null }
        };
        
        return CA.agile.technicalservices.util.WsapiUtils.loadWsapiRecords(config);
    },
    
    _getArrayOfMonthsFromSelected: function() {
        var start = this.selectedStart;
        var end = this.selectedEnd;
        this.logger.log("_getArrayOfMonthsFromSelected", start, end);
        var months = [start];
        var next_month = Rally.util.DateTime.fromIsoString(start);
        var next_month_iso = start;
        
        while ( start != end && end > next_month_iso ) {
            next_month = Rally.util.DateTime.add(next_month, 'month', 1),
            
            next_month_iso = Ext.Date.format(next_month,'Y-m-01');
            months.push(next_month_iso);
        }
        
        months = Ext.Array.unique(months);

        this.logger.log('for months:', months);
        return months;
    },
    
    _fetchAlreadyEnteredData: function(initiatives) {
        var deferred = Ext.create('Deft.Deferred'),
            key_prefix = TSKeys.percentageKeyPrefix,
            me = this;
        
        this.setLoading("Finding entered percentages...");

        var promises = [];
        this.logger.log('_fetchAlreadyEnteredData', initiatives.length);
        
        Ext.Array.each(this._getArrayOfMonthsFromSelected(), function(month){
            promises.push( function() { return me._fetchAlreadyEnteredDataForMonth(month,key_prefix); } );
        });
        
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(prefs) {
                prefs = Ext.Array.flatten(prefs);
                
                this.logger.log('found prefs:', prefs.length);
                
                var prefs_by_oid = {};
                Ext.Array.each(prefs, function(pref){
                    var pref_oid = this._getPrefObjectFromKey(pref.get('Name'));
                    
                    if ( Ext.isEmpty(pref_oid) ) { return; }
                    if (Ext.isEmpty(prefs_by_oid[pref_oid])) {
                        prefs_by_oid[pref_oid] = [];
                    }
                    
                    prefs_by_oid[pref_oid].push(pref);
                },this);
                deferred.resolve([initiatives,prefs_by_oid]);
            },
            failure: function(msg) {
                deferred.reject(msg)
            }
        });
        
        return deferred.promise;
    },
    
    _getPrefObjectFromKey: function(key) {
        var pref_array = key.split('.');
        if ( pref_array.length != 5 ) { return null; }
        return pref_array[4];
    },
    
    _getPrefMonthFromKey: function(key) {
        var pref_array = key.split('.');
        if ( pref_array.length != 5 ) { return null; }
        return pref_array[3];
    },
    
    displayGrid: function(initiatives) {
        this.logger.log('displayGrid', initiatives);
        
        var store = Ext.create('Rally.data.custom.Store',{
            model:'TSModel',
            data: initiatives,
            groupField: 'ObjectID'
        });
        
        this._clearDisplayBox();
        
        var display_box = this.getDisplayBox();
        
        this.grid = display_box.add({
            xtype:'rallygrid',
            columnCfgs: this._getColumns(),
            store: store,
            showRowActionsColumn : false,
            disableSelection: true,
            enableColumnMove: false,
            enableColumnResize : false,
            features: [{
                ftype: 'grouping',
                startCollapsed: true,
                groupHeaderTpl: '{[values.rows[0].data.FormattedID]}: {[values.rows[0].data.Name]}'
            }]
        });
        this.down('#export_button').setDisabled(false);
    },
    
    _getColumns: function() {
        var columns = [
//            { 
//                text: 'ID',       
//                xtype: 'templatecolumn', 
//                tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate',{
//                    showIcon: false,
//                    showHover: true
//                })
//            },
//            { dataIndex:'Name',text:'Name', flex: 1},
            { 
                dataIndex: 'FormattedID',
                text: 'ID',
                hidden: true
            },
            {
                dataIndex: 'Name',
                text: 'Name',
                hidden: true
            },
            { 
                text: 'Team',
                dataIndex: 'Team',
                flex: 1,
                renderer: function(value,meta,record){
                    if ( Ext.isObject(value) ) {
                        return value._refObjectName || value.Name;
                    }
                    return value;
                }
            },
            { 
                text: 'Team ObjectID',
                dataIndex: 'Team',
                renderer: function(value,meta,record){
                    if ( Ext.isObject(value) ) {
                        return value.ObjectID;
                    }
                    return value;
                }
            }];
        
        var months = this._getArrayOfMonthsFromSelected();
        Ext.Array.each(months, function(month){
            columns.push({ 
                dataIndex:'__prefValues', 
                text: 'Percentage (' + month + ')', 
                width: 100,
                align: 'center',
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return ""; }
                    var value = v[month];
                    
                    if ( Ext.isString(value) ) {
                        value = Ext.JSON.decode(value);
                    }
                    if ( Ext.isEmpty(value) || Ext.isEmpty(value.__percentage) ) { return ""; }
                    
                    return value.__percentage + "%";
                }
            });
            columns.push({ 
                dataIndex:'__prefValues', 
                text: 'Entered By (' + month + ')', 
                width: 100,
                align: 'center',
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return ""; }
                    var value = v[month];
                    
                    if ( Ext.isString(value) ) {
                        value = Ext.JSON.decode(value);
                    }
                    if ( Ext.isEmpty(value) ) { return ""; }
                    
                    return value.__lastChangedBy._refObjectName;
                }
            });
            columns.push({ 
                dataIndex:'__prefValues', 
                text: 'Change Date (' + month + ')', 
                width: 100,
                align: 'center',
                renderer: function(v) {
                    if ( Ext.isEmpty(v) ) { return ""; }
                    var value = v[month];
                    
                    if ( Ext.isString(value) ) {
                        value = Ext.JSON.decode(value);
                    }
                    if ( Ext.isEmpty(value) ) { return ""; }
                    
                    return value.__lastChangedOn;
                }
            });            
        });
           
        return columns;
    },
    
    getSelectorBox: function() {
        return this.down('#selector_box');
    },
    
    getDisplayBox: function() {
        return this.down('#display_box');
    },
    
    getLowestLevelPITypePath: function() {
        return this.PortfolioItemTypes[0].get('TypePath');
    },
    
    _showAppMessage: function(msg){
        var display_box = this.getDisplayBox();
        display_box.removeAll();
        
        var ct = display_box.add({
            xtype: 'container',
            tpl: '<div class="no-data-container"><div class="secondary-message">{message}</div></div>'
        });
        ct.update({message: msg});
    },
    
    _clearDisplayBox: function() {
        var display_box = this.getDisplayBox();
        display_box.removeAll();
    },
    
    getBaseInitiativeFilter: function() {
        if (this.getSetting('query')){
            return Rally.data.wsapi.Filter.fromQueryString(this.getSetting('query'));
        }
        return null;
    },
    
    getSettingsFields: function() {
        var type_path = "PortfolioItem/Initiative";
        if ( this.PortfolioItemTypes && this.PortfolioItemTypes.length > 1) {
            type_path = this.PortfolioItemTypes[1].get('TypePath');
        }
        
        return [
            {
                xtype:'tsfieldvaluepairfield',
                name: 'initiativeFieldValues',
                model: type_path,
                fieldLabel: 'Limit to Initiatives that Had this Field/Value Pairing during the Month:'
            }
//            {
//                xtype: 'textarea',
//                fieldLabel: 'Query',
//                labelAlign: 'right',
//                name: 'query',
//                anchor: '100%',
//                cls: 'query-field',
//                margin: '25 70 0 0',
//                plugins: [
//                    {
//                        ptype: 'rallyhelpfield',
//                        helpId: 194
//                    },
//                    'rallyfieldvalidationui'
//                ],
//                validateOnBlur: false,
//                validateOnChange: false,
//                validator: function(value) {
//                    try {
//                        if (value) {
//                            Rally.data.wsapi.Filter.fromQueryString(value);
//                        }
//                        return true;
//                    } catch (e) {
//                        return e.message;
//                    }
//                }
//            }
        ];
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    _export: function(){
        var me = this;
        this.logger.log('_export');
        
        var grid = this.down('rallygrid');
        var rows = this.rows;
      
        if ( !grid && !rows ) { return; }
        
        var promises = [function() { return Rally.technicalservices.FileUtilities.getCSVFromRows(this,grid,rows); } ];

        if ( !rows || rows.length === 0 ) {
            promises = [function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid); } ];
        }
        var filename = 'report.csv';
        
        this.setLoading("Generating CSV");
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    }
    
});
