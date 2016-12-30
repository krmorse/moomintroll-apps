Ext.define('CA.agile.technicalservices.util.WsapiUtils',{
    singleton: true,
    
    // given a store config, loads the records while returning a promise
    loadWsapiRecords: function(config) {
        var deferred = Ext.create('Deft.Deferred');
        var default_config = {
            autoLoad: true
        };
        var store_config = Ext.Object.merge(default_config, config);

        Ext.create('Rally.data.wsapi.Store',store_config).load({
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
    
    // given a store config, loads the records while returning a promise
    loadSnapshotRecords: function(config) {
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
                    deferred.reject(operation.error.errors.join(','));
                }
            }
        });
        return deferred.promise;
    },
    
    getPortfolioItemTypes: function(workspace) {
        var deferred = Ext.create('Deft.Deferred');
                
        var store_config = {
            fetch: ['Name','ElementName','TypePath'],
            model: 'TypeDefinition',
            filters: [
                {
                    property: 'TypePath',
                    operator: 'contains',
                    value: 'PortfolioItem/'
                }
            ],
            sorters: [ {property:'Ordinal', direction: 'ASC'}],
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load types');
                    }
                }
            }
        };
        
        if ( !Ext.isEmpty(workspace) ) {
            store_config.context = { 
                project:null,
                workspace: workspace._ref ? workspace._ref : workspace.get('_ref')
            };
        }
                
        var store = Ext.create('Rally.data.wsapi.Store', store_config );
                    
        return deferred.promise;
    },
    
    loadWsapiRecordsParallel: function(store_config){
        var deferred = Ext.create('Deft.Deferred'),
            promises = [],
            thread_count = 9,
            me = this;

        var config = Ext.Object.merge({
            pageSize: 2000
        },store_config);
        
        config.autoLoad = false;
        config.limit    = config.pageSize;
        
        this.fetchWsapiCount(store_config).then({
            success: function(totalCount){
                var store = Ext.create('Rally.data.wsapi.Store', config),
                    totalPages = Math.ceil(totalCount/config.pageSize);

                var pages = _.range(1,totalPages+1,1);

                _.each(pages, function(page){
                    promises.push(function () {
                        return me.loadStorePage(page, store);
                    });
                });

                PortfolioItemCostTracking.promise.ParallelThrottle.throttle(promises, thread_count, me).then({
                    success: function(results){
                        deferred.resolve(_.flatten(results));
                    },
                    failure: function(msg){
                        deferred.reject(Ext.String.format("Parallel Load Problem:", msg));
                    }
                });
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred;
    },
    
    fetchWsapiCount: function(store_config){
        var deferred = Ext.create('Deft.Deferred');

        var config = Ext.Object.merge(store_config, {
            fetch: ['ObjectID'],
            limit: 1,
            pageSize: 1
        });
        
        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(Ext.String.format("Count Problem: {1}", operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },
    
    loadStorePage: function(pageNum, store){
        var deferred = Ext.create('Deft.Deferred');
        
        store.loadPage(pageNum, {
            callback: function(records, operation){
                
                if (operation.wasSuccessful()){
                     deferred.resolve(records);
                } else {
                    console.error('Operation:', operation);
                    var msg = operation.error && operation.error.errors.join(',');
                    if ( Ext.isEmpty(msg) ) {
                        deferred.reject('Network issue while loading store page');
                    } else {
                        deferred.reject(msg + " (lsp)");
                    }
                }
            }
        });

        return deferred;
    },
    
    fetchAllowedValues: function(model_name, field_name) {
        var deferred = Ext.create('Deft.Deferred');
        
        Rally.data.ModelFactory.getModel({
            type: model_name,
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
    }
    
});