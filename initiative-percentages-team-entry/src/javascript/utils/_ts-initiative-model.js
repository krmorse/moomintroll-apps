Ext.define('TSModel',{
    extend: 'Ext.data.Model',
    
    fields: [
        { name: '_ref', type: 'string' },
        { name: '_refObjectName', type: 'string' },
        { name: 'Name', type: 'string' },
        { name: 'ObjectID', type: 'int' },
        { name: 'Description', type: 'string' },
        { name: 'FormattedID', type: 'string' },
        { name: '__percentage', type: 'float', defaultValue: 0 }
    ],
    
    save: function() {
        return;
    }
});