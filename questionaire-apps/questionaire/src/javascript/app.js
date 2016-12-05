Ext.define("questionaire", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    layout: 'hbox',
    items: [
        {xtype:'container',itemId:'grid_box', flex: 1},
        {xtype:'container',itemId:'survey_box'}
    ],

    integrationHeaders : {
        name : "questionaire"
    },
    config: {
        defaultSettings: {

        }
    },

    surveyDriver: null,

    launch: function() {

        Ext.create('CA.agile.technicalservices.SurveyDriver',{
            listeners: {
                ready: this.initializeApp,
                problem: this.showErrorNotification,
                scope: this
            }
        });
    },
    initializeApp: function(surveyDriver){
        this.surveyDriver = surveyDriver;
        this.logger.log('initializeApp', this.surveyDriver);
        var grid = this.getGridBox().add({
            xtype: 'rallygrid',
            storeConfig: {
                model: this.surveyDriver.getModel(),
                fetch: this.surveyDriver.getFetch(),
                filters: this.surveyDriver.getFilters()
            },
            columnCfgs: this.surveyDriver.getFetch()
        });
        grid.on('itemdblclick', this.launchSurvey, this);
    },
    launchSurvey: function(grid, record){
        this.getSurveyBox().removeAll();

        this.logger.log('launchSurvey', record.get('FormattedID'));

        var surveyPanel = this.getSurveyBox().add({
            xtype: 'tssurveypanel',
            width: this.getWidth(),
            surveyConfig: this.surveyDriver.getSurveyConfig(),
            record: record
        });
        surveyPanel.on('submit', this.showSuccess, this);
        surveyPanel.on('failure', this.showErrorNotification, this);
    },
    showSuccess: function(record){
        Rally.ui.notify.Notifier.showUpdate({artifact: record});
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg });
    },
    getGridBox: function(){
        return this.down('#grid_box');
    },
    getSurveyBox: function(){
        return this.down('#survey_box');
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
