Ext.define("TSTestAutomationRateCurrent", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "TSTestAutomationRateCurrent"
    },
    
    config: {
        defaultSettings: {
            timeboxType: 'Iteration'
        }
    },

    launch: function() {
        this.timeboxType = this.getSetting('timeboxType');
        this._updateData();
    },
    
    _updateData: function() {
        this.setLoading(true);
        var me = this;
        
        Deft.Chain.pipeline([
            this._fetchBaseTimeboxes,
            this._fetchTestCasesByTimebox,
            this._calculateByTimebox
        ],this).then({
            success: function(testcases_by_timebox){
                this._addChart(testcases_by_timebox);
            },
            
            failure: function(msg){
                Ext.Msg.alert('',msg);
            },
            
            scope: this
        }).always(function(){me.setLoading(false);});
    },
    
    _setMessage: function(msg) {
        this.removeAll();
        this.add({xtype:'container',html:msg});
    },
    
    _addChart: function(testcases_by_timebox) {
        if (Ext.isEmpty(testcases_by_timebox)) { return; }
        this.logger.log('_addChart', testcases_by_timebox);
        
        this.add({
            xtype:'rallychart',
            chartConfig: this._getChartConfig(),
            chartData: this._prepareChartData(testcases_by_timebox),
            chartColors: CA.agile.technicalservices.Colors.getBasicColors()
        });
    },
    
    _prepareChartData: function(testcases_by_timebox) {
        if (Ext.isEmpty(testcases_by_timebox) ) { return testcases_by_timebox; }
        this.logger.log('_prepareChartData', testcases_by_timebox);

        var keys = Ext.Object.getKeys(testcases_by_timebox),
            categories = [],
            data = []; 
        
        Ext.Array.each(keys, function(key){
            var timebox_hash = testcases_by_timebox[key];
            categories.push(timebox_hash.name);
            var value = timebox_hash.trendValue;
            data.push({
                y: value,
                yDisplay: timebox_hash.trend,
                record: timebox_hash
            });
        }, this, true); // run in reverse
        
        var series = [{
            name: 'Rate of Automation',
            data: data
        }];
        this.logger.log('series',series);
        
        return {
            series: series,
            categories: categories
        }
    },
    
    _calculateByTimebox: function(testcases_by_timebox){        
        if (Ext.isEmpty(testcases_by_timebox) ) { return testcases_by_timebox; }
        
        var keys = Ext.Object.getKeys(testcases_by_timebox);
        
        Ext.Array.each(keys, function(key,idx) {
            var timebox_hash = testcases_by_timebox[key];
            
            var trend = 'N/A',
                trend_value = null,
                start_count = 0,
                end_count = 0;
            
            if ( timebox_hash.start.length > 0 ) {
                start_count = timebox_hash.start.length;
                end_count   = timebox_hash.end.length;
                
                trend_value = ( (end_count-start_count) / start_count ) * 100 ;
                trend = Ext.util.Format.number(trend_value, '0.#') + '%';
            }
            Ext.Object.merge(timebox_hash,{
                startCount: start_count,
                endCount  : end_count,
                trend     : trend,
                trendValue: trend_value,
                decorator : ''
            });
            
            var preceding_key = idx+1;
            
            var preceding = testcases_by_timebox["" + preceding_key];
            
            if ( preceding ) {
                if ( Ext.isNumber(timebox_hash.trendValue) ) {
                    if ( Ext.isNumber(preceding.trendValue) ) {
                        if ( timebox_hash.trendValue > preceding.trendValue ) {
                            timebox_hash.decorator = '<span class="icon-up"> </span>';
                        } else if ( timebox_hash.trendValue < preceding.trendValue ) {
                            timebox_hash.decorator = '<span class="icon-down"> </span>';
                        }
                    } else {
                        timebox_hash.decorator = '<span class="icon-up"> </span>';
                    }
                }
            }
            
        });
        
        return testcases_by_timebox;
    },
    
    _fetchBaseTimeboxes: function() {
        var number_of_timeboxes = 2,
            timebox_type = this.timeboxType;
        
        var filters = [
            {property:this._getTimeboxStartField(timebox_type), operator: '<=', value: Rally.util.DateTime.toIsoString(new Date()) }
        ];
        
        var config = {
            model: timebox_type,
            limit: Infinity, //number_of_timeboxes,
            pageSize: 2000, //Math.min(number_of_timeboxes,2000),
            context: {
                projectScopeDown: false,
                projectScopeUp: false
            },
            fetch: ['Name',this._getTimeboxStartField(timebox_type),this._getTimeboxEndField(timebox_type)],
            filters: filters,
            sorters: [{property:this._getTimeboxStartField(timebox_type), direction: 'DESC'}]
        };
        
        return this._loadWsapiRecords(config);
    },
    
    _fetchTestCasesByTimebox: function(timeboxes) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
        this.logger.log('_fetchTestCasesByTimebox', timeboxes);
        
        if ( timeboxes.length == 0 ) {
            this._setMessage(Ext.String.format("App must be run in a project with {0}s.", this.timeboxType));
            return [];
        }
        var promises = [];
        Ext.Array.each(timeboxes, function(timebox,idx){
            promises.push(function() { return me._fetchStartAndEndTestCases(timebox,idx); });
        });
        
        this.logger.log("Promise count: ", promises.length);
        
        CA.agile.technicalservices.promise.ParallelThrottle.throttle(promises,9,this).then({
            success: function(results){
                var testcases_by_timebox = {};
                Ext.Array.each(results, function(result){
                    testcases_by_timebox = Ext.Object.merge(testcases_by_timebox, result);
                });
                deferred.resolve(testcases_by_timebox);
            }, 
            failure: function(msg) { 
                deferred.reject(msg); 
            },
            scope: this
        });
        
        return deferred.promise;
    },
    
    _fetchStartAndEndTestCases: function(timebox,idx) {
        var me = this,
            deferred = Ext.create('Deft.Deferred'),
            timebox_type = this.timeboxType,
            timebox_name = timebox.get('Name'),
            start_date = timebox.get(this._getTimeboxStartField(timebox_type)),
            end_date   = timebox.get(this._getTimeboxEndField(timebox_type));
        
        var promises = [
            function() { return me._fetchTestCasesAt(start_date); },
            function() { return me._fetchTestCasesAt(end_date); }
        ];
        
        Deft.Chain.sequence(promises).then({
            success: function(testcases){
                this.logger.log('test cases:', testcases);
                var testcases_by_timebox = {};
                testcases_by_timebox[idx] = {
                    name: timebox_name,
                    start: testcases[0],
                    end  : testcases[1]
                };
                
                deferred.resolve(testcases_by_timebox);
            }, 
            failure: function(msg) { 
                deferred.reject(msg); 
            },
            scope: this
        });
        return deferred.promise;
    },
    
    _fetchTestCasesAt: function(check_date){
        var config = {
            find: {
                "_TypeHierarchy": "TestCase",
                "_ProjectHierarchy": this.getContext().getProject().ObjectID,
                "__At": check_date,
                "Method": "Automated"
            }
        };
        
        return this._loadLookbackRecords(config);
    },
    
    _getTimeboxStartField: function(timebox_type) {
        var fields = {
            'iteration': 'StartDate',
            'release': 'ReleaseStartDate'
        };
        
        return fields[timebox_type.toLowerCase()];
    },
    
    _getTimeboxEndField: function(timebox) {
        var fields = {
            'iteration': 'EndDate',
            'release': 'ReleaseDate'
        };
        
        return fields[timebox.toLowerCase()];
    },
      
    _getChartConfig: function() {
        return {
            chart: {
                type: 'line',
                zoomType: 'xy'
            },
            title: {text: 'Rate of Automation'},
            subtitle: { text: Ext.String.format("(by {0})", this.timeboxType) },
            tooltip: {
                formatter: function() {
                    return Ext.String.format("<b>{0}</b><br/>Rate Change: <em>{1}</em><br/>Start: {2}<br/>End: {3}",
                       this.key,
                       this.point.yDisplay,
                       this.point.record.startCount,
                       this.point.record.endCount
                    );
                }
            },
            xAxis: {
                labels: {
                    rotation: -45,
                    align: 'right'
                }
            },
            yAxis: {
                title: {
                    text: 'Rate Change (%)'
                }
            },
            plotOptions: {
                line: {
                    marker: {
                        enabled: true
                    }
                }
            }
        };
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model, config);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _loadLookbackRecords: function(config) {
        var deferred = Ext.create('Deft.Deferred');

        var default_config = {
            removeUnauthorizedSnapshots: true
        };
        
        var store_config = Ext.Object.merge(default_config, config);
        
        Ext.create('Rally.data.lookback.SnapshotStore',store_config).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    console.error('operation:', operation);
                    deferred.reject('Trouble loading lookback data');
                }
            }
        });
        return deferred.promise;
    },
    
    getSettingsFields: function() {
        return [{
            name: 'timeboxType',
            xtype: 'combobox',
            label: 'Timebox Type:',
            labelWidth: 150,
            queryMode: 'local',
            displayField:'name',
            valueField:'value',
            store: Ext.create('Ext.data.Store',{
                fields: ['name','value'],
                data: [
                    {name:'Iteration',value:'Iteration'},
                    {name:'Release',value:'Release'}
                ]   
            })
            
        }]
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
