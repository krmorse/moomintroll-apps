Ext.override(Rally.ui.grid.plugin.Validation,{
    _onBeforeEdit: function(editor, object, eOpts) {
        // clear this because it won't let us do the getEditor on cells
    }
});

Ext.define("TSInitiativePercentageEntry", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    layout: 'border',
    
    items: [
        {xtype:'container',itemId:'selector_box',region:'north',layout: 'hbox', defaults: { margin: 10 }},
        {xtype:'container',itemId:'display_box',region: 'center', layout:'fit'}
    ],

    integrationHeaders : {
        name : "TSInitiativePercentageEntry"
    },
    
    config: {
        defaultSettings: {
            validBeforeMonthEnd: 5,
            validAfterMonthEnd: 10,
            initiativeFieldValues: []
        }
    },
    
    launch: function() {
        var me = this;
        this.logger.log('Starting with: ', this.getSettings());
        this.logger.log('App ID (also Panel OID):', this.getAppId());
        
        var before = this.getSetting('validBeforeMonthEnd'),
            after  = this.getSetting('validAfterMonthEnd');
        
        this.monthNameForEntry = TSDateCalculator.getMonthNameInLimits(new Date(), before, after);
        this.monthIsoForEntry = TSDateCalculator.getMonthIsoInLimits(new Date(), before, after);

        this.logger.log("The month iso: ", this.monthIsoForEntry);
        
        if ( Ext.isEmpty(this.monthNameForEntry) ) {
            this._showAppMessage("Entry during this period is closed.");
            return;
        }
        CA.agile.technicalservices.util.WsapiUtils.getPortfolioItemTypes().then({
            success: function(pis) {
                this.PortfolioItemTypes = pis;
                this._addSelectors();
            },
            scope: this
        });
    },
    
    _addSelectors: function() {
        var me = this;
        var container = this.getSelectorBox();
        var project_filter = [{property:'Children.ObjectID',value:''}];
        
        project_filter.push({property:'Owner', value: this.getContext().getUser()._ref});
        
        var project_config = {
            model:'Project',
            filters: project_filter,
            pageSize: 2000,
            sorters: [{property:'Name'}]
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadWsapiRecords(project_config).then({
            success: function(projects) {
                if ( this.getContext().getPermissions().isWorkspaceOrSubscriptionAdmin() ) {
                    container.add({
                        xtype:'rallybutton',
                        text: 'Choose Project',
                        listeners: {
                            scope: this,
                            click: function() {
                                Ext.create('CA.technicalservices.ProjectTreePickerDialog',{
                                    autoShow: true,
                                    title: 'Choose Project',
                                    multiple: false,
                                    leavesOnly: true,
                                    listeners: {
                                        scope: this,
                                        itemschosen: function(item){
                                            console.log('here', item);
                                            this.selectedProject = item.get('_ref');
                                            this._updateData();
                                        }
                                    }
                                });
                            }
                        }
                    });
                } else {
                
                    if ( projects.length === 0 ) {
                        this._showAppMessage("You must own at least one project to use this app.");
                        return;
                    }
                    
                    if ( projects.length == 1 ) {
                        container.add({
                            xtype:'container',
                            html: Ext.String.format("<b>Team:</b> {0}",
                                projects[0].get('_refObjectName')
                            )
                        });
                        
                        this.selectedProject = projects[0].get('_ref');
                        this._updateData();
                        return;
                    }
                                    
                    var project_data = Ext.Array.map(projects, function(project){return project.getData();});
                    
                    container.add({
                        xtype:'combo',
                        store: Ext.create('Ext.data.Store',{
                            fields: ['_refObjectName','ObjectID','_ref'],
                            data: project_data
                        }),
                        fieldLabel: 'Team',
                        labelWidth: 45,
                        displayField: '_refObjectName',
                        valueField: '_ref',
                        typeAhead: true,
                        queryMode: 'local'
                    }).on(
                        'change', 
                        function(cb) {
                            this.selectedProject = cb.getValue();
                            this._updateData();
                        }, 
                        me
                    );
                }
                
                container.add({
                    xtype:'container',
                    cls: 'month-name-display',
                    html: this.monthNameForEntry
                });
        
            },
            scope: this
        });
    },
    
    _updateData: function() {
        this._clearDisplayBox();
       
        if ( Ext.isEmpty(this.selectedProject) ) {
            return;
        }
        this.logger.log('_updateData',this.selectedProject);
        
        var project_ref = this.selectedProject;
        
        Deft.Chain.pipeline([
            function() { return this._fetchActiveStoryHierarchies(project_ref); },
            this._fetchInitiativesFromHierarchies,
            this._filterOutInitiatives,
            this._fetchAlreadyEnteredData
        ],this).then({
            success: function(results) {
                var initiatives = results[0],
                    prefs_by_oid = results[1];
                
                this.logger.log("prefs by oid:", prefs_by_oid);
                
                var models = Ext.Array.map(initiatives, function(initiative) {
                    return initiative.getData();
                });
                
                Ext.Array.each(models, function(model){
                    model.__monthStart = this.monthIsoForEntry;
                    model.__dataProjectRef = this.selectedProject;

                    if (!Ext.isEmpty(model.ObjectID)){
                        model.__pref = prefs_by_oid[model.ObjectID];
                    }
                },this);
                
                this.displayGrid(models);
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
        var deferred = Ext.create('Deft.Deferred'),
            project_oid = Rally.util.Ref.getOidFromRef(project_ref);
        
        var month_start = this.monthIsoForEntry;
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(month_start), 'month', 1
            )
        );
        var active_states = ['Defined','In-Progress','Completed'];

        var config = {
            find: {
                _TypeHierarchy: { "$in": ['HierarchicalRequirement'] },
                 Project: project_oid,
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
            hydrate: ['Project']
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config).then({
            success: function(snapshots) {
                if ( snapshots.length === 0 ) {
                    deferred.reject({msg: 'There were no active stories in the month for this project.'});
                    return;
                }
                var hierarchies = {};
                
                Ext.Array.map(snapshots, function(snapshot){
                    hierarchies[snapshot.get('ObjectID')] = snapshot.get('_ItemHierarchy');
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
        var month_start = this.monthIsoForEntry;
        var next_month = Rally.util.DateTime.toIsoString(
            Rally.util.DateTime.add(
                Rally.util.DateTime.fromIsoString(month_start), 'month', 1
            )
        );
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
            fetch: ['ObjectID']
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadSnapshotRecords(config).then({
            success: function(snapshots) {
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
                
                deferred.resolve( valid_initiatives );
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    _fetchAlreadyEnteredData: function(initiatives) {
        var deferred = Ext.create('Deft.Deferred'),
            key_prefix = TSKeys.percentageKeyPrefix,
            month_start = this.monthIsoForEntry;
        
        var config = {
            model: 'Preference',
            fetch: ['Name','Value'],
            filters: [
                {property:'Name',operator:'contains',value: key_prefix + "." + month_start},
                {property:'Project', value: this.selectedProject}
            ],
            context: { project: null }
        };
        
        CA.agile.technicalservices.util.WsapiUtils.loadWsapiRecords(config).then({
            success: function(prefs) {
                var prefs_by_oid = {};
                Ext.Array.each(prefs, function(pref){
                    var pref_name = pref.get('Name');
                    var pref_array = pref_name.split('.');
                    if ( pref_array.length != 5 ) { return; }
                    prefs_by_oid[pref_array[4]] = pref;
                });
                deferred.resolve([initiatives,prefs_by_oid]);
            },
            failure: function(msg) {
                deferred.reject(msg)
            }
        });
        
        return deferred.promise;
    },
    
    displayGrid: function(initiatives) {
        this.logger.log('displayGrid', initiatives);
        
        var store = Ext.create('Rally.data.custom.Store',{
            model:'TSModel',
            data: initiatives
        });
        
        this._clearDisplayBox();
        
        var display_box = this.getDisplayBox();
        
        display_box.add({
            xtype:'rallygrid',
            width: 400,
            columnCfgs: this._getColumns(),
            store: store,
            showPagingToolbar : false,
            showRowActionsColumn : false,
            disableSelection: true,
            enableColumnMove: false,
            enableColumnResize : false,
            features: [{
                ftype: 'summary',
                dock: 'bottom'
            }]
        });
    },
    
    _getColumns: function() {
        return [
            { 
                text: 'Full Name',       
                xtype: 'templatecolumn', 
                tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate',{
                    showIcon: false,
                    showHover: true
                })
            },
            { dataIndex:'Name',text:'Name', flex: 1},
            { 
                dataIndex:'__percentage', 
                text: 'Percentage', 
                width: 100,
                align: 'center',
                sortable: true,
                field:'test',
                getEditor: function(record,df) {
                    return Ext.create('Ext.grid.CellEditor', {
                        field: Ext.create('Rally.ui.NumberField', {
                            xtype:'rallynumberfield',
                            minValue: 0,
                            maxValue: 100,
                            disabled: false,
                            allowDecimals: false,
                            selectOnFocus: true,
                            allowBlank: true,
                            validator: function(value) {
                                value = value || 0;
                                
                                var grid = this.up('rallygrid'),
                                    store = grid && grid.getStore();
                                
                                if ( !store ) {
                                    return true;
                                }
                                
                                var count = store.getTotalCount();
                                var total = 0;
                                
                                // get the values in the store
                                for ( var i=0; i<count; i++ ) {
                                    var stored_record = store.getAt(i);
                                    var row_value = stored_record.get('__percentage') || 0;
                                    total = total + row_value;
                                }
                                // adjust for change (original value is already 
                                // in the store so the loop above pulled it, but we
                                // want to replace it with the new value
                                var original_value = record.get("__percentage") || 0;
                                
                                total = total - original_value + parseFloat(value,10);
                                
                                if ( total > 100) {
                                    return "The total (" + total + ") is greater than 100%";
                                }
                                return true;
                            }
                        })
                    });
                },
                summaryType: function(values){
                    var total = 0;
                    Ext.Array.each(values, function(value){
                        total += value.get('__percentage') || 0;
                    });
                    return total;
                },
                summaryRenderer: function(value, summaryData, dataIndex) {
                    if ( value === 0 ) { return; }
                    return Ext.String.format('TOTAL: {0}%', value); 
                },
                renderer: function(value,meta,record) {
                    if ( value === null || isNaN(value)) {
                        return "";
                    }
                    return value + '%';
                }
            }
        ];
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
                xtype:'rallynumberfield',
                name: 'validBeforeMonthEnd',
                fieldLabel: 'Days Before Month End',
                minValue: 0,
                maxValue: 14
            },
            { 
                xtype:'rallynumberfield',
                name: 'validAfterMonthEnd',
                fieldLabel: 'Days After Month End',
                minValue: 0,
                maxValue: 14
            },
            {
                xtype:'tsfieldvaluepairfield',
                name: 'initiativeFieldValues',
                model: type_path,
                fieldLabel: 'Initiative Field Matched During the Month:'
            }
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
    }
    
});
