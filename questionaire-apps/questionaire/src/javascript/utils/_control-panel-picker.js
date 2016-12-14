Ext.define('CA.agile.technicalservices.control.PanelPicker',{
    extend: 'Ext.container.Container',
    alias: 'widget.panelpicker',

    layout: 'hbox',
    allowEndOfSurvey: true,

    padding: 0,

    config: {
        valueField: 'value',
        displayField: 'name'
    },
    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },
    initComponent: function(){

       var data  = [{
            name: '-- Submit Form --',
            value: null
        }];

        var pastCurrentSection = false;
        Ext.Array.each(this.keys, function(key){
            if (key == this.currentSection){
                pastCurrentSection = true;
                return true;
            }
            if (pastCurrentSection){
                data.push({
                    name: Ext.String.format('Section [{0}]', key),
                    value: key
                });
            }

        }, this);

        var panelStore = Ext.create('Rally.data.wsapi.Store',{
            data: data,
            fields: ['name', 'value']
        }, this);

        var config = Ext.apply(this.config, {
            xtype: 'rallycombobox',
            store: panelStore
        });

        this.items = [config];
        this.callParent(arguments);

    },
    getValue: function(){
        return this.down('rallycombobox').getValue();
        //return this.down('#' + this.itemId).getValue();
    }
});