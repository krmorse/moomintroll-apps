Ext.define("TSConfigurablePieChart", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    layout: 'hbox',
    items: [
        {
            xtype:'panel', 
            itemId:'chart_box', 
            flex: 1,
            hideCollapseTool: true,
            collapsible: true,
            collapsed: false,
            collapseDirection: 'left',
            minHeight: 400
        },
        {xtype:'container', itemId:'detail_box'}
    ],
    
    integrationHeaders : {
        name : "TSConfigurablePieChart"
    },
    
    config: {
        defaultSettings: {
            types: 'defect',
            chartType: 'piechart',
            aggregationField: 'State',
            aggregationType: 'count',
            query: '',
            useNoneForBlank: true
        }
    },

    launch: function() {
        this.logger.log('Starting with:', this.getSettings());
        var me = this;
        
        this.typeDisplayName = this.getSetting('types').replace(/.*\//,'');
        
        this._loadModel(this.getSetting('types')).then({
            success: function(model) {
                var field = model.getField(this.getSetting('aggregationField'));
                this.fieldDisplayName = field.displayName;
                this.typeDisplayName = this.getSetting('types').replace(/.*\//,'');

                this._updateData();
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
            },
            scope: this
        }).always(function(){ me.setLoading(false);});
    },
    
    _updateData: function() {
        var me = this;
        this.setLoading("Loading...");
        
        Deft.Chain.pipeline([
            this._loadAllowedValues,
            this._loadAggregationData,
            this._prepareChartData,
            this._makeChart
        ],this).then({
            success: function(){
                me.setLoading(false);
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
                me.setLoading(false);

            }
        });
    },
    
    _loadModel: function(record_type) {
        var deferred = Ext.create('Deft.Deferred');
        
        Rally.data.ModelFactory.getModel({
            type: record_type,
            success: function(model) {
                deferred.resolve(model);
            }
        });
        return deferred.promise;
    },
    
    _loadAllowedValues: function() {
        var deferred = Ext.create('Deft.Deferred');
        var record_type = this.getSetting('types');
        var field_name = this.getSetting('aggregationField');
        
        Rally.data.ModelFactory.getModel({
            type: record_type,
            success: function(model) {
                model.getField(field_name).getAllowedValueStore().load({
                    callback: function(allowed_values, operation, success) {
                        deferred.resolve(Ext.Array.map(allowed_values, function(allowed_value){
                            return allowed_value.get('StringValue');
                        }));
                    }
                });
            }
        });
        return deferred.promise;
    },
    
    _loadAggregationData: function(allowed_value_array) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        this.setLoading("Loading data...");

        this.logger.log('_loadAggregationData - allowed values:', allowed_value_array);
        
        var promises = [];
        Ext.Array.each(allowed_value_array, function(value){
            var key = value;
            if ( me.getSetting('aggregationType') == 'count' ) {
                promises.push(function() { return me._getCountForGroup(value); });
            } else {
                promises.push(function() { return me._getSumForGroup(value); });
            }
        });
        
        Deft.Chain.parallel(promises, this).then({
            success: function(results) {
                var data_by_group_name = {};
                Ext.Array.each(allowed_value_array, function(value,idx){
                    var key = value;
                    if (Ext.isEmpty(value) && this.getSetting('useNoneForBlank')) {
                        key = "None";
                    }
                    data_by_group_name[key] = results[idx];
                },this);
                
                deferred.resolve(data_by_group_name);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _getSumForGroup: function(value) {
        var deferred = Ext.create('Deft.Deferred'),
            record_type = this.getSetting('types'),
            field_name = this.getSetting('aggregationField'),
            value_field = this._getFieldForAggregationType(this.getSetting('aggregationType'));
        
        var config = {
            model: record_type,
            filters: [{property:field_name,value:value}],
            fetch: ['Value',value_field],
            limit: Infinity,
            pageSize: 2000
        };
        
        this._loadWsapiRecords(config).then({
            success: function(results) {
                results = results || [];
                
                var values = Ext.Array.map(results, function(result) {
                    var value = result.get(value_field) || 0;
                    if ( Ext.isObject(value) ) {
                        value = value.Value;
                    }
                    return value;
                });
                
                deferred.resolve(Ext.Array.sum(values));
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _getCountForGroup: function(value) {
        var record_type = this.getSetting('types');
        var field_name = this.getSetting('aggregationField');
        
        var config = {
            model: record_type,
            filters: [{property:field_name,value:value}]
        };
        
        return this._loadWsapiCount(config);
    },
    
    _loadWsapiCount: function(config){
        var deferred = Ext.create('Deft.Deferred');

        config.pageSize = 1;
        config.limit = 1;

        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(operation.error.errors.join(','));
                }
            }
        });
        return deferred.promise;
    },
    
    _loadWsapiRecords: function(config) {
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation.error.errors.join(','));
                }
            }
        });
        return deferred.promise;
    },

    _prepareChartData: function(aggregated_data_hash) {
        this.logger.log('_prepareChartData - aggregated_data_hash:', aggregated_data_hash);
        var series = [],
            me = this;
        
        Ext.Object.each(aggregated_data_hash, function(key,value){
            series.push({
                name: key,
                y: value,
                events: {
                    click: function() {
                        me._showDetails(key, value);
                    }
                }
            });
        });
                
        var chart_data = { 
            series: [{
                name: '',
                data: series
            }], 
            categories: Ext.Object.getKeys(aggregated_data_hash) 
        };
                
        return chart_data;
    },
    
    _makeChart: function(chart_data) {
        this.logger.log('_makeChart chart_data:', chart_data);
        
        this.down('#chart_box').add({
            xtype:'rallychart',
            chartData: chart_data,
            chartConfig: {
                chart: {
                    type: 'pie',
                    plotBackgroundColor: null,
                    plotBorderWidth: null,
                    plotShadow: false
                },
                title: {text: this.typeDisplayName + " by " + this.fieldDisplayName},
                subtitle: { text: Ext.String.format('({0})',
                            this._getFieldForAggregationType(this.getSetting('aggregationType')) || 'Count'
                         )},
                tooltip: {
                    headerFormat: '',
//                    pointFormat: '{point.name}: <b>{point.percentage:.1f}%</b>'
                    pointFormat: '{point.name}: <b>{point.y}</b>'
                },
                plotOptions: {
                    pie: {
                        allowPointSelect: true,
                        cursor: 'pointer',
                        dataLabels: {
                            enabled: true,
                            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                            style: {
                                color: 'black'
                            }
                        }
                    }
                }
            }
        });
        return;
    },
    
    _showDetails: function(group_name, value) {
        if ( value === 0 ) {
            return;
        }
        
        var group_value = group_name;
        if ( group_name == "None" ) { group_value = ""; }
        
        var filters = [{
            property:this.getSetting('aggregationField'),
            value: group_value
        }];

        var chart_box = this._getChartBox();
        chart_box.collapse();
        
        var container = this._getDetailBox();
        container.removeAll();
        
        container.add({
            xtype:'panel',
            hideCollapseTool: true,
            collapsible: true,
            collapsed: false,
            collapseDirection: 'right',
            headerPosition: 'left',
            header: true,
            cls: 'detail-panel',
            width: this.getWidth() - 100,
            height: this.getHeight() - 100,
            layout: 'border',
            margin: 5,
            items: [{
                xtype: 'container',
                region: 'north',
                layout: 'hbox',
                items: [{
                    xtype: 'rallybutton',
                    cls: 'detail-collapse-button icon-leave',
                    width: 18,
                    margin: '0 10 0 25',
                    userAction: 'Close (X) filter panel clicked',
                    listeners: {
                        click: function() {
                            chart_box.expand();
                            this.up('panel').destroy();
                        }
                    }
                },{
                    xtype: 'container',
                    flex: 1,
                    html: Ext.String.format(
                        '<div class="detail-title">{0}: {1} = {2}</div>',
                        this.typeDisplayName,
                        this.fieldDisplayName,
                        group_name
                    )
                }]
            },{
                xtype:'rallygrid',
                margin: '3 10 10 25',
                region:'center',
                layout: 'fit',
                storeConfig: {
                    model: this.getSetting('types'),
                    filters: filters
                },
                columnCfgs: this._getColumns()
            }]
        });
        
    },
    
    _getDetailBox: function() {
        return this.down('#detail_box');
    },
    
    _getChartBox: function() {
        return this.down('#chart_box');
    },
    
    _getColumns: function() {
        var columns = ['FormattedID','Name','Project','Owner',this.getSetting('aggregationField')];
        if ( this._getFieldForAggregationType(this.getSetting('aggregationType')) ) {
            columns.push(this._getFieldForAggregationType(this.getSetting('aggregationType')));
        }
        return columns;
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

    getSettingsFields: function() {
        var me = this;
        return [
            {
                name: 'types',
                xtype: 'rallycombobox',
                plugins: ['rallyfieldvalidationui'],
                allowBlank: false,
                editable: false,
                autoSelect: false,
                validateOnChange: false,
                validateOnBlur: false,
                fieldLabel: 'Type', //todo: delete when multiselect enabled
                // multiSelect: true, //todo: need to validate either all artifacts chosen or only one non-artifact
                shouldRespondToScopeChange: true,
                context: this.getContext(),
                // initialValue: ['HierarchicalRequirement'], //todo: not working
                storeConfig: {
                    model: 'TypeDefinition',
                    sorters: [{ property: 'DisplayName' }],
                    fetch: ['DisplayName', 'TypePath'],
                    filters: [{ property: 'UserListable', value: true }],
                    autoLoad: false,
                    remoteSort: false,
                    sortOnLoad: true,
                    remoteFilter: true
                },
                displayField: 'DisplayName',
                valueField: 'TypePath',
                listeners: {
                    change: function (combo) {
                        combo.fireEvent('typeselected', combo.getValue(), combo.context);
                    },
                    ready: function (combo) {
                      combo.fireEvent('typeselected', combo.getValue(), combo.context);
                    }
                },
                bubbleEvents: ['typeselected'],
                readyEvent: 'ready',
                handlesEvents: {
                    projectscopechanged: function (context) {
                        this.refreshWithNewContext(context);
                    }
                }
            },
            {
                name: 'aggregationField', //todo: don't validate on settings load
                xtype: 'rallyfieldcombobox',
                plugins: ['rallyfieldvalidationui'],
                fieldLabel: 'Aggregate By',
                readyEvent: 'ready',
                allowBlank: false,
                validateOnChange: false,
                validateOnBlur: false,
                _isNotHidden: function(field) {
                    if ( field.hidden ) { return false; }
                    var defn = field.attributeDefinition;
                    if ( !field.attributeDefinition) { return false; }
                    
                    if ( field.name == "State" ) { return true; }
                    
                    if ( defn.AttributeType != 'STRING' || !defn.Constrained ) {
                        return false;
                    }
                    
                    return true;
                },
                handlesEvents: {
                    typeselected: function (models, context) {
                        var type = Ext.Array.from(models)[0];
                        if (type) {
                            this.refreshWithNewModelType(type, context); //todo: how to handle multiple models
                        } else {
                            this.store.removeAll();
                            this.reset();
                        }
                    }
                },
                listeners: {
                    ready: function (combo) {
                        combo.store.filterBy(function (record) {
                            var field = record.get('fieldDefinition'),
                                attr = field.attributeDefinition;
                            return attr && !attr.Hidden && attr.AttributeType !== 'COLLECTION' &&
                                !field.isMappedFromArtifact;
                        });
                        var fields = Ext.Array.map(combo.store.getRange(), function (record) {
                            return record.get(combo.getValueField());
                        });

                        if (!Ext.Array.contains(fields, combo.getValue())) {
                            combo.setValue(fields[0]);
                        }
                    }
                }
            },
            {
                name: 'aggregationType',
                xtype: 'rallycombobox',
                plugins: ['rallyfieldvalidationui'],
                fieldLabel: 'Aggregation Type',
                displayField: 'name',
                valueField: 'value',
                editable: false,
                allowBlank: false,
                store: Ext.create('Ext.data.Store', {
                    fields: ['name', 'value'],
                    data: [
                        { name: 'Count', value: 'count' },
                        { name: 'Preliminary Estimate Value', value: 'prelimest' },
                        { name: 'Leaf Story Plan Estimate Total', value: 'leafplanest' }
                    ]
                }),
                handlesEvents: {
                    typeselected: function (types, context) {
                        var type = Ext.Array.from(types)[0];
                        Rally.data.ModelFactory.getModel({
                            type: type,
                            success: function(model) {
                                this.store.filterBy(function(record) {
                                    return record.get('value') === 'count' ||
                                        model.hasField(me._getFieldForAggregationType(record.get('value')));
                                });        
                            },
                            scope: this
                        });

                    }
                }
            },
            { type: 'query' }
        ];
    },

    _getFieldForAggregationType: function(aggregationType) {
        if (aggregationType === 'estimate') {
            return 'PlanEstimate';
        } else if (aggregationType === 'prelimest') {
            return 'PreliminaryEstimate';
        } else if (aggregationType === 'leafplanest') {
            return 'LeafStoryPlanEstimateTotal';
        }
    }
    
});
