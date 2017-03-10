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
            if (cfg.type === 'text'){
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
        var items = [],
            options = cfg.options;

        if (options.length > 0){
            items.push({
                xtype: 'container',
                html: cfg.text,
                cls: 'survey-instructions',
                padding: 10,
                margin: 10
            });

            for (var i=0; i<cfg.options.length; i++){
                var opt = options[i];
                if (opt){
                    var checked = cfg.value === i;

                    items.push({
                        xtype: 'rallyradiofield',
                        boxLabel: opt.text,
                        name: 'optChoice',
                        inputValue: i,
                        value: checked,
                        margin: '20 10 20 30',
                        boxLabelAlign: 'after',
                        boxLabelCls: 'survey-question',
                        listeners: {
                            change: this.choiceUpdated,
                            scope: this
                        }
                    });
                }
            }
        }
        return items;
    },
    choiceUpdated: function(radioBtn){
        if (radioBtn.value === true){
            this.fireEvent('choiceupdated', radioBtn.inputValue);
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

        if (this.surveyContainerCfg.type === 'text'){
            return this.down('#rteDescription').getValue();
        }
        var key = this.down('rallyradiofield[value=true]');
        if (key){
            return key.inputValue;
        }
        return null;
    },
    getNextPanelKey: function(){
        if (!this.surveyContainerCfg){
            return null;
        }

        if (this.surveyContainerCfg.type === 'choice'){
            var optionIdx = this.getValue();
            if (this.surveyContainerCfg.options[optionIdx]){
                return this.surveyContainerCfg.options[optionIdx].nextSection || null;
            }
            return null;
        }
        return this.surveyContainerCfg.nextSection || null;
    },
    validate: function(){

        if (!this.surveyContainerCfg){
            return true;
        }

        if (this.surveyContainerCfg.type === 'choice' && this.getValue() !== null){
            return this.getValue() >= 0;
        }
        return this.down('#rteDescription') && this.down('#rteDescription').getValue() && this.down('#rteDescription').getValue().length > 0;
    }
});