Ext.define("tsDefectLeakage", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'display_box'}
    ],
    
    config: {
        defaultSettings: {
            fieldToCount: 'Environment',
            model: 'Defect'
        }
    },
    
    integrationHeaders : {
        name : "tsDefectLeakage"
    },
                        
    launch: function() {
        var me = this;
        
        var field = this.getSetting('fieldToCount'),
            model = this.getSetting('model');
        
        CA.agile.technicalservices.util.WsapiUtils.fetchAllowedValues(model,field).then({
            success: function(values) {
                var promises = Ext.Array.map(values, function(value){
                    return function() { return me._getCountFor(value); };
                });
                Deft.Chain.parallel(promises,me).then({
                    success: function(results) {
                        var counts = {};
                        Ext.Array.each(results, function(result){
                            counts = Ext.Object.merge(counts, result);
                        });
                        
                        var leakage = this._getLeakageFromCounts(values, counts);
                        var chart_data = this._getChartData(values,counts,leakage);
                        
                        this._makeChart(chart_data);
                    },
                    failure: function(msg) {
                        deferred.reject(msg);
                    },
                    scope: this
                });
                
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
            },
            scope: this
        });
    },
    
    _getCountFor: function(value) {
        var deferred = Ext.create('Deft.Deferred'),
            field = this.getSetting('fieldToCount');
        
        var config = {
            model: this.getSetting('model'),
            filters: [{property:field, value: value}]
        };
        
        CA.agile.technicalservices.util.WsapiUtils.fetchWsapiCount(config).then({
            success: function(result) {
                var count = {};
                count[value] = result;
                
                deferred.resolve(count);
            },
            failure: function(msg) { deferred.reject(msg); }
        });
        
        return deferred.promise;
    },
    
    _getLeakageFromCounts: function(allowed_values, counts) {
        this.logger.log(counts);
        var leakage = {};
        Ext.Array.each(allowed_values, function(value,idx){
            var current_count = counts[value] || 0;

            if ( current_count === 0 ) { 
                leakage[value] = null;
                return;
            }
            
            var total_after = 0;
            Ext.Array.each(allowed_values, function(v,i){
                if (i > idx) {
                    var count = counts[v] || 0;
                    total_after = total_after + count;
                }
            });
            
            leakage[value] = 100 * (total_after) / current_count;
        });
        
        return leakage;
    },
    
    _getChartData: function(values,counts,leakage) {
        var categories = Ext.Array.map(values, function(value){
            if ( Ext.isEmpty(value) ) { return "-- No Entry --"; }
            return value;
        });
        
        var series_data = Ext.Array.map(values, function(value){
            return { y: leakage[value], _count: counts[value] };
        });
        
        return {
            categories: categories,
            series: [{
                data: series_data
            }]
        }
    },
    
    _makeChart: function(chart_data) {
        var colors = CA.agile.technicalservices.Colors.getBasicColors();
        
        if ( this._hasData(chart_data) ) {
            this.add({
                xtype:'rallychart',
                chartData: chart_data,
                chartConfig: this._getChartConfig(),
                chartColors: colors
            });
        } else {
            this.add({
                xtype:'container',
                html: 'No Data Found.',
                margin: 15
            })
        }
    },
    
    _hasData: function(chart_data) {
        var has_data = false;
        Ext.Array.each(chart_data.series[0].data, function(datum){
            if ( datum.y !== null ) { has_data = true; }
        });
        return has_data;
    },
    
    _getChartConfig: function() {
        return {
            chart: { 
                type:'column',
                zoomType:'xy'
            },
            title: { text: 'Defect Leakage' },
            xAxis: {},
            yAxis: { 
                min: 0,
                title: { text: 'Leakage (%)' }
            },
            tooltip: {
                headerFormat: "<span style='font-size:12px;font-weight:bolder;'>{point.key}: </span>",
                pointFormat: "<span style='font-size:12px;'>{point.y:.1f}% </span> " +
                    "<span style='font-size:10px;'> ({point._count})</span>",
                useHTML: true
            },
            legend: {
                enabled: false
            },
            plotOptions: {
                series: {
                    minPointLength: 1
                }
            }
        };
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
