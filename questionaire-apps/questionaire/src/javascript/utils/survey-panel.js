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
    height: 500,
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
                xtype: 'rallybutton',
                cls: 'detail-collapse-button icon-leave',
                width: 18,
                margin: '0 10 0 25',
                userAction: 'Close (X) filter panel clicked',
                listeners: {
                    click: this.close
                }
            },{
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
        console.log('config', config, this.config);

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
            },
            {
                xtype: 'rallybutton',
                itemId: 'submitButton',
                text: this.submitText,
                cls: ['commentActionButton', 'commentSave', 'primary', 'rly-small'],
                handler: this._submit,
                scope: this,
                visible: false
            }
        ]);
        this.down('#submitButton').setVisible(false);
    },
    _cancel: function() {
        this.fireEvent('cancel');
        this.close();
    },
    _submit: function(){

        if (!this.getQuestionCt().validate()){
            return;
        }
        this.survey.submit(this.getQuestionCt().getKey(),this.getQuestionCt().getValue()).then({
            success: function(record){
                this.fireEvent('submit', record);
            },
            failure: function(msg){
                this.fireEvent('failure', msg);
            },
            scope: this
        }).always(function(){ this.close(); }, this);
    },
    _nextQuestion: function(btn){

        if (!this.getQuestionCt().validate()){
            return;
        }
        var containerCfg = this.survey.getNextContainerConfig(this.getQuestionCt().getKey(), this.getQuestionCt().getValue());

        this.down('#backButton').setDisabled(this.survey.isFirstButton());
        this.down('#submitButton').setVisible(!containerCfg.hasChildren);
        this.down('#nextButton').setDisabled(!containerCfg.hasChildren);

        this._updateQuestion(containerCfg);

    },
    _previousQuestion: function(){
        var containerCfg = this.survey.getPreviousContainerConfig(this.getQuestionCt().getKey(), this.getQuestionCt().getValue());
        this._updateQuestion(containerCfg);
    },
    _initializeSurvey: function(){
        if(!this.rendered){
            this.on('afterrender', this._initializeSurvey, this);
            return;
        }
        var cfg = this.survey.getInitialContainerConfig();
        this._updateQuestion(cfg);
    },
    getQuestionCt: function(){
        return this.down('#questionCt');
    },
    _updateQuestion: function(questionConfig){

        this.logger.log('_updateQuestion, cfg', questionConfig);
        if (this.getQuestionCt()){ this.getQuestionCt().destroy(); }
        this.add(questionConfig);
    },
    close: function(){
        this.survey.destroy();
        this.destroy();
    }
});