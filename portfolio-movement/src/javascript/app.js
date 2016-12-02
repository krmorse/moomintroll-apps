Ext.define("portfolio-movement", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
         {xtype:'container',itemId:'grid_box', flex: 1}
    ],

    integrationHeaders : {
        name : "portfolio-movement"
    },

    config: {
        defaultSettings: {
            portfolioItemFetch: ['ActualStartDate','ActualEndDate','AcceptedLeafStoryCount','ObjectID','LeafStoryCount','StateChangedDate'],
            portfolioItemType: 'PortfolioItem/Initiative',
            flags: [{
                flagRule: function(record){
                    var flagStates = ['Measuring','Done'];
                    var state = record.get('State') && record.get('State').Name;
                    if (Ext.Array.contains(flagStates, state) && record.get('LeafStoryCount') > 0){
                        if (record.get('ActualStartDate') && !record.get('ActualEndDate')){
                            return true;
                        }
                    }
                    return false;
                },
                flagValue: function(record){
                    var value = 0;
                    if (record.get('LeafStoryCount') > 0){
                        value = record.get('LeafStoryCount') - record.get('AcceptedLeafStoryCount');
                    }
                    return value;
                },
                text: "Active Stories exist",
                tooltip: "Active Stories exist for a Portfolio Item that is not in the In-Progress or Staging State.",
                dataIndex: '__activeStoriesInMeasuring'
            }],
            query: '(StateChangedDate = today-30)'
        }
    },
                        
    launch: function() {
       this.logger.log('launch settings', this.getSettings());

       if (!this.validateApp()){
           return;
       }
        this.initializeApp();
    },
    validateApp: function(){
        return true;
    },
    initializeApp: function(){

        this.buildPortfolioStore();
    },
    buildPortfolioStore: function(){
        this.getGridBox().removeAll();
        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.getModelNames(),
            enableHierarchy: true,
            fetch: this.getDefaultFetch(),
            enableRootLevelPostGet: true,
            filters: this.getFilters()
        }).then({
            success: this.buildGrid,
            scope: this
        });
    },
    buildGrid: function(store) {
        store.model.addField({name: '__lastUserToChangeState', type: 'auto', defaultValue: null});
        Ext.Array.each(this.getFlags(), function(flag){
            store.model.addField({name: flag.dataIndex, type: 'auto', defaultValue: null});
        });

        store.on('load', this.updatePortfolioItems, this);

        var filters = this.getFilters();
        this.logger.log('buildGrid filters', filters.toString());
        this.add({
            xtype: 'rallygridboard',
            context: this.getContext(),
            modelNames: this.getModelNames(),
            toggleState: 'grid',
            width: '95%',
           // stateful: true,
           // stateId: this.getContext().getScopedStateId('movementgridboard'),
            plugins: this.getGridPlugins(),
            gridConfig: {
                //stateful: true,
                //stateId: this.getContext().getScopedStateId('fsgrid'),
                store: store,
                storeConfig: {
                    filters: filters
                },
                columnCfgs: this.getColumnConfigs(),
                derivedColumns: this.getDerivedColumns()
            },
            height: this.getHeight()
        });
    },
    getUserHash: function(){
        if (!this.userHash){
            this.userHash = {};
        }
        return this.userHash;
    },
    updatePortfolioItems: function(store, node, records){
        this.logger.log('updatePortfolioItems', node.getDepth(), records);
        if (node.getDepth() > 0 || records.length === 0){
            return;
        }

        this.updateFlags(records);
        this.updateStateChangedUsers(records);

    },
    updateFlags: function(records){

        this.suspendEvents();
        for (var i=0; i<records.length; i++){
            Ext.Array.each(this.getFlags(), function(flag){
                var val = false;
                if (flag.flagRule(records[i])){
                    val = flag.flagValue(records[i]);
                }
                records[i].set(flag.dataIndex, val);
            });
        }
        this.resumeEvents();
    },
    updateStateChangedUsers: function(records){
        var earliestStateChange = new Date(),
            oids = [],
            userHash = this.getUserHash();

        this.setLoading('Finding last updated users...');

        Ext.Array.each(records, function(r){
            if (r.get('StateChangedDate') && r.get('StateChangedDate') < earliestStateChange){
                earliestStateChange = r.get('StateChangedDate');
            }
            oids.push(r.get('ObjectID'));
        });
        earliestStateChange = Rally.util.DateTime.toIsoString(earliestStateChange);

        var config = {
            //find: {
            //    _TypeHierarchy: this.getModelNames()[0],
            //    _ProjectHierarchy: this.getContext().getProject().ObjectID,
            //    _ValidFrom: {$gte: earliestStateChange },
            //    "_PreviousValues.State": {$exists: true}
            //},
            find: {
                ObjectID: {$in: oids},
                _ValidFrom: {$gte: earliestStateChange },
                "_PreviousValues.State": {$exists: true}
            },
            fetch: ['_User','ObjectID','_ValidFrom','_ValidTo','State'],
            sort: {'_ValidFrom': -1}
        };
        this.logger.log('updatePortfolioItems.fetchSnapshots config', config);


        CA.agile.technicalservices.Toolbox.fetchSnapshots(config).then({
            success: function(snapshots){
                this.logger.log('updatePortfolioItems.fetchSnapshots.success',snapshots);
                var snapsByOid = CA.agile.technicalservices.Toolbox.organizeSnapsByOid(snapshots),
                    usersToLoad = [];

                Ext.Array.each(records, function(r){
                    var snaps = snapsByOid[r.get('ObjectID')];
                    //this assumes that the first snap is the latest with a state change.
                    if (snaps && snaps.length > 0 && !userHash[snaps[0]._User]){
                        usersToLoad.push(snaps[0]._User);
                    }
                });

                this.fetchUsers(usersToLoad).then({
                    success: function(){
                        Ext.Array.each(records, function(r){
                            var snaps = snapsByOid[r.get('ObjectID')];
                            //this assumes that the first snap is the latest with a state change.
                            if (snaps && snaps.length > 0){
                                if (userHash[snaps[0]._User]){
                                    r.set('__lastUserToChangeState',userHash[snaps[0]._User]);
                                }
                            }
                        });
                    },
                    failure: this.showErrorNotification,
                    scope: this
                });
            },
            failure: this.showErrorNotification,
            scope: this
        }).always(function(){
            this.setLoading(false);
        }, this);
    },
    getGridPlugins: function(){
        return [{
            ptype: 'rallygridboardfieldpicker',
            headerPosition: 'left',
            modelNames: this.getModelNames(),
            //stateful: true,
            margin: '3 3 3 25',
            stateId: this.getContext().getScopedStateId('movementfp')
        },{
            ptype: 'rallygridboardinlinefiltercontrol',
            inlineFilterButtonConfig: {
                stateful: true,
                stateId: this.getContext().getScopedStateId('movementfilter'),
                modelNames: this.getModelNames(),
                margin: 3,
                inlineFilterPanelConfig: {
                    quickFilterPanelConfig: {
                        defaultFields: [
                            'ArtifactSearch',
                            'Owner',
                            'ModelType'
                        ]
                    }
                }
            }
        }, {
            ptype: 'rallygridboardactionsmenu',
            menuItems: [
                {
                    text: 'Export Current Grid Page...',
                    handler: this.exportCurrentPage, handler: this.exportCurrentPage,
                    scope: this
                }
            ],
            buttonConfig: {
                margin: 3,
                iconCls: 'icon-export'
            }
        }];
    },
    getColumnConfigs: function(){
        return [{
            dataIndex: 'Name',
            text: 'Name',
            flex: 3
        },{
            dataIndex: 'State',
            text: 'State',
            flex: 1
        }].concat(this.getDerivedColumns());
    },
    getDerivedColumns: function(){
        var cols = [];
        Ext.Array.each(this.getFlags(), function(flag){
            //var tpl = '<div><tpl if="' + flag.dataIndex + '">' +
            //    '<div class="flagged" ><div class="icon-flag"></div><span class="tooltiptext">' + flag.tooltip || flag.text  + '</span></div>' +
            //    '</tpl></div>';

            var templateConfig = [
                '{[this.formatFlag(values["' + flag.dataIndex + '"])]}',
                {
                    formatFlag:function (value) {
                        return (value) ? Ext.String.format('<div class="flagged"><span class="tooltiptext">{0}</span><div class="icon-flag"></div></div>',flag.tooltip || flag.text) : '';
                    }
                }];


            cols.push({
                dataIndex: flag.dataIndex,
                xtype: 'templatecolumn',
                text: flag.text,
                flex: 1,
                tpl: templateConfig,
                sortable: false

            });
        });

       cols.push({
            dataIndex: '__lastUserToChangeState',
            xtype: 'templatecolumn',
            text: 'State Changed User',
            flex: 2,
           sortable: false,
        tpl:  '<div>{[values.__lastUserToChangeState && values.__lastUserToChangeState._refObjectName]}</div>'
        });


        return cols;
    },
    fetchUsers: function(userOids){
        this.logger.log('fetchUsers', userOids);
        var deferred = Ext.create('Deft.Deferred');
        if (userOids.length === 0){
            deferred.resolve();
            return deferred.promise;
        }

        var filters = Ext.Array.map(userOids, function(u){ return {
            property: 'ObjectID',
            value: u
        }});
        filters = Rally.data.wsapi.Filter.or(filters);

        this.setLoading('Loading User data...');
        CA.agile.technicalservices.Toolbox.fetchWsapiRecords({
            model: 'User',
            fetch: ['DisplayName','ObjectID'],
            filters: filters
        }).then({
            success: function(users){
                Ext.Array.each(users, function(u){
                    this.userHash[u.get('ObjectID')] = u.getData();
                }, this);
                deferred.resolve();
            },
            failure: this.showErrorNotification,
            scope: this
        }).always(function(){this.setLoading(false);},this);
        return deferred.promise;
    },
    getFilters: function(){
        if (this.getSetting('query')){
            return Rally.data.wsapi.Filter.fromQueryString(this.getSetting('query'));
        }
        return [];
    },
    getDefaultFetch: function(){
        var fetch = [],
            fetchSetting = this.getSetting('portfolioItemFetch');
        if (!Ext.isArray(fetchSetting)){
            fetch = Ext.JSON.decode(fetchSetting);
        } else {
            fetch = fetchSetting;
        }
        return fetch;    },
    getFlags: function(){
        var flags = [],
            flag_setting = this.getSetting('flags');
        if (!Ext.isArray(flag_setting)){
            flags = Ext.JSON.decode(flag_setting);
        } else {
            flags = flag_setting;
        }
        return flags;

    },
    getModelNames: function(){
        return [this.getSetting('portfolioItemType')];
    },
    getGridBox: function(){
        return this.down('#grid_box');
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
    getSettingsFields: function(){
        var labelWidth = 175;

        return [{
            xtype: 'rallyportfolioitemtypecombobox',
            name: 'portfolioItemType',
            valueField: 'TypePath',
            fieldLabel: 'Portfolio Item Type',
            labelAlign: 'right',
            labelWidth: labelWidth
        },{
            xtype: 'textarea',
            fieldLabel: 'Query',
            labelAlign: 'right',
            labelWidth: labelWidth,
            name: 'query',
            anchor: '100%',
            cls: 'query-field',
            margin: '25 70 0 0',
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
        }];
    },
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
