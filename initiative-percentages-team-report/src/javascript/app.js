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
        // this._showAppMessage("You must be a workspace or subscription admin to use this app.");
        
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
        
        for ( var i=0; i<12; i++ ) {
            var month_iso = Ext.Date.format(current_date, 'Y-m');
            month_data.push({name:month_iso,value:month_iso + '-01'});
            current_date = Rally.util.DateTime.add(current_date,'month',-1);
        }
        
        return month_data;
    },
    
    _addSelectors: function() {
        var me = this,
            container = this.getSelectorBox();
//        var project_filter = [{property:'Children.ObjectID',value:''}];
    
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
            this._fetchActiveStoryHierarchies,
            this._fetchInitiativesFromHierarchies,
            this._filterOutInitiatives,
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
                    this.logger.log('--', initiative.FormattedID);
                    var oid = initiative.ObjectID;
                    
                    initiative.__prefValues = {};
                    Ext.Array.each(months, function(month) {
                        initiative.__prefValues[month] = null;
                    });
                    
                    this.logger.log('project for oid:', this.projectsForArtifactOid[oid]);
                    Ext.Array.each(this.projectsForArtifactOid[oid], function(project_name){
                        var clone = Ext.clone(initiative);
                        clone.Project = project_name;
                        Ext.Array.each(prefs_by_oid[oid], function(pref){
                            if ( pref.get('Project')._refObjectName == project_name ) {
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
        });
    },
    
    _fetchActiveStoryHierarchies: function(project_ref) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        
        var month_start = this.selectedStart;
        
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(this.selectedEnd), 'month', 1
            )
        );
        this.logger.log('_fetchActiveStoryHierarchies', month_start, next_month);
        
        //
        var active_states = ['Defined','In-Progress','Completed'];
        
        var config = {
            find: {
                _TypeHierarchy: { "$in": ['HierarchicalRequirement'] },
                "$or": [
                {
                    ScheduleState: { "$in":  active_states},
                    "_PreviousValues.ScheduleState": { "$exists": true },
                    "_ValidFrom": {
                        "$gte": month_start,
                        "$lt":  next_month
                    }
                },
                {
                    ScheduleState: { "$in": active_states },
                    __At: month_start
                },
                {
                    ScheduleState: { "$in": active_states },
                    __At: next_month
                }
                ]
            },
            fetch: ['ObjectID','_ItemHierarchy','Project'],
            hydrate: ['Project'],
            useHttpPost: true
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config).then({
            success: function(snapshots) {
                if ( snapshots.length === 0 ) {
                    deferred.reject({msg: 'There were no active stories in the month.'});
                    return;
                }
                var hierarchies = {};
                
                Ext.Array.map(snapshots, function(snapshot){
                    hierarchies[snapshot.get('ObjectID')] = snapshot.get('_ItemHierarchy');
                    var project = snapshot.get('Project').Name
                    
                    Ext.Array.each(snapshot.get('_ItemHierarchy'), function(oid) {
                        if ( Ext.isEmpty(me.projectsForArtifactOid[oid])) {
                            me.projectsForArtifactOid[oid] = [];
                        }
                        me.projectsForArtifactOid[oid] = Ext.Array.merge(me.projectsForArtifactOid[oid],[project]);
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
    
    _fetchInitiativesFromHierarchies: function(hierarchies) {
        this.logger.log('_fetchInitiativesFromHierarchies',hierarchies);

        if ( hierarchies.length === 0 ) { return []; }
        
        var oids = [];
        Ext.Array.each(hierarchies, function(hierarchy){
            hierarchy.pop();
            oids = Ext.Array.push(oids,hierarchy);
        });
        
        oids = Ext.Array.unique(oids);
        var filters = Rally.data.wsapi.Filter.or(
            Ext.Array.map(oids, function(oid){
                return { property:'ObjectID',value:oid }
            })
        );
        
        if ( Ext.isEmpty(filters) ) { return []; }
        
        var base_filter = this.getBaseInitiativeFilter();
        if ( !Ext.isEmpty(base_filter) ) {
            filters = filters.and(base_filter);
        }
        
        var config = {
            model: this.PortfolioItemTypes[1].get('TypePath'),
            filters: filters,
            fetch: ['FormattedID','Name','Notes','Description','Project'],
            enablePostGet: true,
            context: { project: null }
        };
        return CA.agile.technicalservices.util.WsapiUtils.loadWsapiRecords(config);
    },
    
    /*
     * Want to filter out initiatives that did not match a particular value during the month
     * 
     */
    _filterOutInitiatives: function(initiatives) {
        var initiative_filters = this.getSetting('initiativeFieldValues');
        if ( Ext.isEmpty(initiatives) || Ext.isEmpty(initiative_filters) ) { return initiatives; }
        
        var deferred = Ext.create('Deft.Deferred');
        if ( Ext.isString(initiative_filters) ) {
            initiative_filters = Ext.JSON.decode(initiative_filters);
        }
        var month_start = this.selectedStart;
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(this.selectedEnd), 'month', 1
            )
        );
        
        this.logger.log('_filterOutInitiatives', month_start, next_month);

        var oids = Ext.Array.map(initiatives, function(initiative) { return initiative.get('ObjectID'); });
        
        initiative_filters.push({property:'ObjectID',operator:'in', value: oids});
        
        var base_filters = Rally.data.lookback.QueryFilter.and(initiative_filters);
        
        var filters = base_filters.and(
            Ext.create('Rally.data.lookback.QueryFilter',{property:'_TypeHierarchy', operator:'in', value:['PortfolioItem']})
        );
        
        filters = filters.and(
            Ext.create('Rally.data.lookback.QueryFilter',{property:'_ValidFrom', operator:'>=', value:month_start})
        );
    
        filters = filters.and(
            Ext.create('Rally.data.lookback.QueryFilter',{property:'_ValidFrom', operator:'<', value:next_month})
        );
        
        var config = {
            filters: filters,
            fetch: ['ObjectID'],
            pageSize: 2000,
            useHttpPost: true
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config).then({
            scope: this,
            success: function(snapshots) {
                this.logger.log('snapshots:', snapshots.length);
                
                if ( snapshots.length === 0 ) {
                    deferred.reject({msg: 'No initiatives meet the filters.'});
                    return;
                }
                
                var valid_items = {};
                Ext.Array.map(snapshots, function(snapshot){
                    valid_items[snapshot.get('ObjectID')] = snapshot;
                });
                
                var valid_initiatives = Ext.Array.filter(initiatives, function(initiative){
                    var oid = initiative.get('ObjectID');
                    return !Ext.isEmpty(valid_items[oid]);
                });
                
                this.logger.log('found valid initiatives with stories:', valid_initiatives.length);
                
                deferred.resolve( valid_initiatives );
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _fetchAlreadyEnteredDataForMonth: function(month_start,key_prefix) {
        this.logger.log('_fetchAlreadyEnteredDataForMonth', month_start, key_prefix);
        var config = {
            model: 'Preference',
            fetch: ['Name','Value','Project'],
            filters: [
                {property:'Name',operator:'contains',value: key_prefix + "." + month_start}
            ],
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
                dataIndex: 'Project',
                flex: 1,
                renderer: function(value,meta,record){
                    if ( Ext.isObject(value) ) {
                        return value._refObjectName;
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
                    if ( Ext.isEmpty(value) ) { return ""; }
                    
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
        var type_path = this.PortfolioItemTypes[1].get('TypePath');
        return [
            {
                xtype:'tsfieldvaluepairfield',
                name: 'initiativeFieldValues',
                model: type_path,
                fieldLabel: 'Initiative Field Matched During the Month:'
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
        
        if ( !rows ) {
            rows = [];
            var store = grid.getStore();
            var count = store.getTotalCount();
            for ( var i=0; i<count; i++ ) {
                rows.push(store.getAt(i));
            }
        }
        var filename = 'report.csv';
        
        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities.getCSVFromRows(this,grid,rows); } 
        ]).then({
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
