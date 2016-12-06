Ext.define('CA.agile.technicalservices.SurveyContainer',{
    extend: 'Ext.container.Container',
    alias: 'widget.surveycontainer',

    config: {
        itemId: 'questionCt'
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.surveyContainerCfg = config.surveyContainerCfg;
        this.record = config.record;

        this.callParent([this.config]);
    },
    initComponent: function() {

        var cfg = this.surveyContainerCfg,
            items = this._getNoItems();

        if (cfg){
            if (cfg.type === 'description'){
                items = this._getDescriptionItems(cfg);
            } else {
                items =  this._getChoiceItems(cfg);
            }
        }
        this.items = items;
        this.callParent(arguments);
    },
    _getNoItems: function() {
        return [{
            xtype: 'container',
            html: '<div class="survey-title">Survey Completed</div>'
        }];
    },
    _getChoiceItems: function(cfg){
        var items = [];

        if (cfg.options.length > 0){
            items.push({
                xtype: 'container',
                html: cfg.text,
                cls: 'survey-instructions',
                padding: 10,
                margin: 10
            });
            Ext.Array.each(cfg.options, function(opt){
                if (opt){
                    items.push({
                        xtype: 'rallyradiofield',
                        boxLabel: opt.text,
                        name: 'optChoice',
                        inputValue: opt.nextKey,
                        value: cfg.value === opt.nextKey,
                        margin: '20 10 20 30',
                        boxLabelAlign: 'after',
                        boxLabelCls: 'survey-question',
                        listeners: {
                            change: this.choiceUpdated,
                            scope: this
                        }
                    });
                }
            }, this);
        }
        return items;
    },
    choiceUpdated: function(radioBtn){
        if (radioBtn.value === true){
            this.fireEvent('choiceupdated', radioBtn && radioBtn.inputValue);
        }
    },
    _getDescriptionItems: function(cfg){
        var subItems = [{
            xtype: 'rallyrichtexteditor',
            itemId: 'rteDescription',
            value: cfg.value || this.record && this.record.get(cfg.field) || "",
            margin: 5,
            flex: 1,
            frame: true,
            minHeight: 200 + 53,
            width: '50%'
        }];

        if (cfg.exampleValue){
            subItems.push({
                xtype: 'container',
                itemId: 'rteExample',
                padding: 10,
                readOnly: true,
                html: cfg.exampleValue,
                margin: 5,
                minHeight: 200 + 53,
                border: 1,
                style: {
                    borderColor: '#ccc',
                    borderStyle: 'solid',
                    borderRadius: 3
                },
                width: '50%'
            });
        }

        return [{
            xtype: 'container',
            html: cfg.text,
            cls: 'survey-instructions',
            padding: 10
        },{
            xtype: 'container',
            layout: 'hbox',
            padding: 10,
            items: subItems
        }];
    },
    getValue: function() {
        if (!this.surveyContainerCfg){ return null;}

        if (this.surveyContainerCfg.type === 'description'){
            return this.down('#rteDescription').getValue();
        }
        var key = this.down('rallyradiofield[value=true]');
        return key && key.inputValue;
    },
    getNextPanelKey: function(){
        if (!this.surveyContainerCfg){
            return null;
        }

        if (this.surveyContainerCfg.type === 'choice'){
            return this.getValue();
        }
        return this.surveyContainerCfg.nextKey || null;
    },
    validate: function(){
        return true;

        if (!this.surveyContainerCfg){
            return true;
        }

        if (this.surveyContainerCfg.type === 'choice'){
            return this.getValue();
        }
        return this.down('#rteDescription').getValue().length > 0;
    }
});