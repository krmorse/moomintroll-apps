Ext.define('TSModel',{
    extend: 'Ext.data.Model',

    fields: [
        { name: '_ref', type: 'string' },
        { name: '_refObjectName', type: 'string' },
        { name: 'Name', type: 'string' },
        { name: 'ObjectID', type: 'int' },
        { name: 'Description', type: 'string' },
        { name: 'FormattedID', type: 'string' },
        { name: '__percentage', type: 'float', defaultValue: 0 },
        { name: 'Team', type:'object' },
        { name: '__prefValues', type:'object' }, // should be a hash with keys = month starts
        { name: '__pref', type: 'object', convert: function(pref,record) {
            if ( Ext.isEmpty(pref) ) { return; }
            var value = Ext.JSON.decode(pref.get('Value'));
            record.set('__lastChangedBy',value.__lastChangedBy);
            record.set('__lastChangedOn', value.__lastChangedOn);
            record.set('__percentage', value.__percentage);
            return pref;
        }},
        { name: '__lastChangedBy', type: 'object' },
        { name: '__lastChangedOn', type: 'string' },
        { name: '__monthStart', type: 'string' },
        { name: '__dataProjectRef', type:'string' } // for the pref to be assigned to
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
            __percentage: this.get('__percentage')
        });
        
        var pref = this.get('__pref');
        if ( Ext.isEmpty(pref) ) {
            console.log("Creating value for new pref:", json_value);
            return this._createPreference(json_value);
        } else {
            console.log("Saving value for existing pref:", json_value);
            pref.set('Value',json_value);
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
                        me.set('__pref', result[0]);
                    }
                });
            }
        });
    }
});