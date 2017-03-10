Ext.define('CA.agile.technicalservices.SurveyPanel', {
    extend: 'Ext.panel.Panel',
    alias: 'widget.tssurveypanel',

    requires: [
        'Rally.ui.Button'
    ],

    logger: new Rally.technicalservices.Logger(),
   // border: false,
   // closable: false,
    ui: 'info-box',
    hideCollapseTool: true,
    collapsible: true,
    collapsed: false,
    height: 400,
    width: '100%',
    collapseDirection: 'right',
    headerPosition: 'left',
    header: true,
    cls: 'detail-panel',

    padding: 10,
    overflowY: 'auto',

    config: {
        /**
         * @cfg {Rally.data.wsapi.Model} (required)
         * The record that the new comment belongs to.
         */
        record: null,
        surveyConfig: null,
        nextText: 'Next >',
        submitText: 'Submit',
        previousText: '< Back'
    },

    dockedItems: [{
        xtype: 'container',
        dock: 'top',
        items: [{
            xtype: 'container',
            flex: 1,
            layout: 'hbox',
            items: [{
                xtype: 'container',
                flex: 1,
                itemId: 'panelTitle',
                tpl: '<tpl><div class="survey-title">{title} for {initiativeID}</div><div class="survey-description">{instructions}</div></tpl>'
            }]
        }]
    },{
        xtype: 'toolbar',
        dock: 'bottom',
        layout: {
            type: 'hbox',
            pack: 'center'
        },
        ui: 'footer',
        itemId: 'footer'
    }],

    bubbleEvents: ['failure'],

    constructor: function(config){
        this.mergeConfig(config);

        this.survey = Ext.create('CA.agile.technicalservices.Survey',config.surveyConfig);
        this.survey.setRecord(this.record);

        this.callParent([this.config]);
    },
    initComponent: function() {

        this.callParent(arguments);

        this.down('#panelTitle').update({
            title: this.survey.getTitle(),
            instructions: this.survey.getInstructions(),
            initiativeID: this.survey.getID()
        });

        this.drawFooter();

        this._initializeSurvey();

    },
    drawFooter: function(){
        this.logger.log('drawFooter');
        this.down('#footer').add([
            {
                xtype: 'rallybutton',
                text: 'Cancel',
                float: 'left',
                cls: ['commentActionButton', 'commentCancel', 'secondary', 'rly-small'],
                handler: this._cancel,
                scope: this

            },{
                xtype: 'container',
                flex: 1
            },{

                xtype: 'rallybutton',
                text: this.previousText,
                itemId: 'backButton',
                disabled: true,
                cls: ['commentActionButton', 'commentCancel', 'secondary', 'rly-small'],
                handler: this._previousQuestion,
                scope: this
            },
            {
                xtype: 'rallybutton',
                itemId: 'nextButton',
                text: this.nextText,
                cls: ['commentActionButton', 'commentSave', 'primary', 'rly-small'],
                handler: this._nextQuestion,
                scope: this
            },{
                xtype: 'container',
                flex: 1
            },{
                xtype: 'rallybutton',
                itemId: 'submitButton',
                text: this.submitText,
                cls: ['commentActionButton', 'commentSave', 'primary', 'rly-small'],
                handler: this._submit,
                scope: this,
                float: 'right',
                visible: false
            }
        ]);
        this.down('#submitButton').setVisible(false);
    },
    _cancel: function() {
    	this.survey.clearValues();
        this.fireEvent('cancel');
        this.close();
    },
    _submit: function(){


        if (!this._getSurveyContainer().validate()){
            Rally.ui.notify.Notifier.showWarning({message: 'Please select a choice or enter a text value.'});
            return;
        }

         this.survey.submit(this._getSurveyContainer().getValue(), this.preview).then({
            success: function(record){
                this.fireEvent('submit', record);
            },
            failure: function(msg){
                this.fireEvent('failure', msg);
            },
            scope: this
        }).always(function(){ this.close(); }, this);
    },
    _nextQuestion: function(){

        if (!this._getSurveyContainer().validate()){
            Rally.ui.notify.Notifier.showWarning({message: "Please select a choice or enter a text value."});
            return;
        }
        this.survey.setValue(this._getSurveyContainer().getValue());
        var cfg = this.survey.getPanelCfg(this._getSurveyContainer().getNextPanelKey());
        this._updatePanel(cfg);
    },
    _previousQuestion: function(){

        var cfg = this.survey.getPreviousPanelCfg();
        this._updatePanel(cfg);
    },
    _initializeSurvey: function(){
        if(!this.rendered){
            this.on('afterrender', this._initializeSurvey, this);
            return;
        }
        var cfg = this.survey.getPanelCfg();
        this._updatePanel(cfg);
    },
    close: function(){
        this.survey.destroy();
        this.fireEvent('destroy');
        this.destroy();
    },
    _getSurveyContainer: function(){
        return this.down('surveycontainer');
    },
    _updatePanel: function(panelCfg){
        if (this._getSurveyContainer()){ this._getSurveyContainer().destroy(); }

        var ct = this.add({
            xtype: 'surveycontainer',
            surveyContainerCfg: panelCfg,
            record: this.record
        });
        ct.on('choiceupdated', this._updateButtons, this);

        if (panelCfg.type === 'choice'){
            this._updateButtons(panelCfg.value);
        } else {
            this._updateButtons();
        }

    },
    _updateButtons: function(choiceValue){
        var isLast = this.survey.isLast(choiceValue);

        this.down('#backButton').setDisabled(this.survey.isFirst());
        this.down('#submitButton').setVisible(isLast);
        this.down('#nextButton').setDisabled(isLast);
    }
});