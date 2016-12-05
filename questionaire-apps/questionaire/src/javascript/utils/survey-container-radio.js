Ext.define('CA.agile.technicalservices.surveycontainer.Radio',{
    extend: 'Ext.container.Container',
    alias: 'widget.surveycontainerradio',

    config: {
        itemId: 'questionCt'
    },

    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    initComponent: function() {

        var questions = this.questions,
            items = [];

        if (questions.length > 0){
            items.push({
                xtype: 'container',
                html: this.instructions,
                cls: 'survey-instructions',
                padding: 10,
                margin: 10
            });
            Ext.Array.each(questions, function(q){
                console.log('q', q.key);
                if (q){
                    items.push({
                        xtype: 'rallyradiofield',
                        boxLabel: q.question,
                        name: 'q1',
                        inputValue: q.key,
                        value: q.value,
                        margin: '20 10 20 30',
                        boxLabelAlign: 'after',
                        boxLabelCls: 'survey-question'
                    });
                }
            });
        }
        this.items = items;
        this.callParent(arguments);
    },

    getValue: function() {
        var key = this.down('rallyradiofield[value=true]');
        return key && key.inputValue;
    },
    getKey: function(){
        return this.key;
    },
    validate: function(){
        //todo: make sure a value is selected.
        return true;
    }
});