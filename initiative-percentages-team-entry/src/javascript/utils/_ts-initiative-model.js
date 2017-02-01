Ext.define('TSModel',{
    extend: 'Ext.data.Model',

    fields: [
        { name: '_ref', type: 'string' },
        { name: '_refObjectName', type: 'string' },
        { name: 'Name', type: 'string' },
        { name: 'ObjectID', type: 'int' },
        { name: 'Description', type: 'string' },
        { name: 'FormattedID', type: 'string' },
        { name: 'Project', type:'object' },
        { name: '__pref', type: 'object', defaultValue: undefined},

        { name: '__percentage', type: 'float', useNull: true, defaultValue: undefined, convert: function(value,record){
            // if value is passed directly, just take it
            if ( !Ext.isEmpty(value) || value === 0 ) { return value; }
            
            // if we've already created the record fully, and we get here it means someone
            // is blanking it out in the grid  (convert functions are run in order)
            if ( record.get('__instantiated') ) { return undefined; }
            
            var pref = record.get('__pref');

            if ( Ext.isEmpty(pref) ) { return undefined; }
            var pref_value = Ext.JSON.decode(pref.get('Value'));
            return pref_value.__percentage;
        } },

        { name: '__lastChangedBy', type: 'object', convert: function(value,record){
            // if value is passed directly, just take it
            if ( !Ext.isEmpty(value) ) { return value; }
            var pref = record.get('__pref');

            if ( Ext.isEmpty(pref) ) { return null; }
            var pref_value = Ext.JSON.decode(pref.get('Value'));
            return pref_value.__lastChangedBy;
        } },
        { name: '__lastChangedOn', type: 'string', convert: function(value,record){
            // if value is passed directly, just take it
            if ( !Ext.isEmpty(value) ) { return value; }
            var pref = record.get('__pref');
            if ( Ext.isEmpty(pref) ) { return null; }
            var pref_value = Ext.JSON.decode(pref.get('Value'));
            return pref_value.__lastChangedOn;
        }},
        { name: '__monthStart', type: 'string' },
        { name: '__dataProjectRef', type:'string' }, // for the pref to be assigned to
        
        { name: '__instantiated', type:'boolean', defaultValue: false, convert: function(value,record) { return true; } } // end of the list!
    ],
    
    getKey: function() {
            var key = Ext.String.format("{0}.{1}.{2}",
                TSKeys.percentageKeyPrefix,
                this.get('__monthStart'),
                this.get('ObjectID')
            );
            return key;
    },

    save: function(v) {
        var changes = this.getChanges();

        if (! Ext.isObject(changes) ) {
            return;
        }
        
        var user = Rally.getApp().getContext().getUser();

        this.set('__lastChangedBy', {
            ObjectID: user.ObjectID,
            _ref: user._ref,
            _refObjectName: user._refObjectName,
            UserName: user.UserName
        });
        var timestamp = Rally.util.DateTime.toIsoString(new Date());
        this.set('__lastChangedOn', timestamp);
        
        return this._savePercentage();
    },
    
    _savePercentage: function() {
        var me = this;
        
        var json_value = Ext.JSON.encode({
            __lastChangedOn: this.get('__lastChangedOn'),
            __lastChangedBy: this.get('__lastChangedBy'),
            __percentage:    this.get('__percentage')
        });
        
        var pref = this.get('__pref');
        if ( Ext.isEmpty(pref) ) {
            console.log("Creating value for new pref:", json_value);
            return this._createPreference(json_value);
        } else {
            console.log("Saving value for existing pref:", json_value);
            pref.set('Value', json_value);
            return pref.save();
        }
    },
    
    _createPreference: function(json_value) {
        var me = this,
            key = this.getKey(),
            project_ref = this.get('__dataProjectRef');
        
        var config = {
            Project: project_ref,
            Name: key,
            Value: json_value
        };
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            scope: this,
            success: function(model) {
                var pref = Ext.create(model,config);
                pref.save({
                    callback: function(result, operation) {
                        me.set('__pref', result);
                    }
                });
            }
        });
    }
});