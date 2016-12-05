Ext.define('CA.agile.technicalservices.surveycontainer.Description',{
    extend: 'Ext.container.Container',
    alias: 'widget.surveytypedescriptiontemplate',

    config: {
        itemId: 'questionCt'
    },

    /**
     *
     * questions configuration
     *  words: 'Please describe your ideal animal' (question instructions)
     *  exampleValue: 'Expected Description:<br/><br/>I like tubby orange cats.'  (template description)
     *  field: 'Description'  (field to update)
     */

    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    initComponent: function() {

        var question = this.questions[0];

        this.items = [{
            xtype: 'container',
            html: this.instructions,
            cls: 'survey-instructions',
            padding: 10
        },{
            xtype: 'container',
            layout: 'hbox',
            padding: 10,
            items: [{
                xtype: 'rallyrichtexteditor',
                itemId: 'rteDescription',
                value: question.value || this.record.get(question.field),
                margin: 5,
                flex: 1,
                frame: true,
                minHeight: 200 + 53,
                width: '50%'
            },{
                xtype: 'container',
                itemId: 'rteExample',
                padding: 10,
                readOnly: true,
                html: question.exampleValue,
                margin: 5,
                minHeight: 200 + 53,
                border: 1,
                style: {
                    borderColor: '#ccc',
                    borderStyle: 'solid',
                    borderRadius: 3
                },
                width: '50%'
            }]
        }];

        this.callParent(arguments);
    },

    getValue: function() {
        return this.down('#rteDescription').getValue();
    },
    getKey: function(){
        return this.key;
    },
    validate: function(){
        //todo: make sure a value is selected.
    }
});