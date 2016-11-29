Ext.define('CA.agile.technicalservices.renderer.template.FlagTemplate', {
    extend: 'Ext.XTemplate',

    config: {
        /**
         * @cfg {String}
         * the name of the field to find the value for
         */
        fieldName: ''
    },

    constructor: function(config) {
        this.initConfig(config);
        console.log('fieldName', this.dataIndex);
        var templateConfig = [
            '{[this.formatBoolean(values["' + this.dataIndex + '"])]}',
            {
                formatBoolean:function (value) {
                    return (value) ? '<div class="flagged"><div iconCls="icon-flag"></div></div>' : '';
                }
            }];

        return this.callParent(templateConfig);

    }
});