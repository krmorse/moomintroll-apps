Ext.define("questionaire", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    items: [
        {xtype:'container',itemId:'grid_box', flex: 1},
        {xtype:'container',itemId:'survey_box'}
    ],

    integrationHeaders : {
        name : "questionaire"
    },
    config: {
        defaultSettings: {
            appMode: 'admin',
            surveyType: 'PortfolioItem/Initiative',
            surveyTitle: 'My Survey Title',
            surveyQuery: '',
            panels: null
        }
    },
    surveyDriver: null,

    MODE_ADMIN: 'admin',
    MODE_PREVIEW: 'preview',
    MODE_PUBLISH: 'publish',


    launch: function() {
        var appMode = this.getAppMode();

        this.removeAll();

        if (!this.isUserAdmin() && appMode === this.MODE_ADMIN){
            this.addAppMessage("You need to be an administrator to create and publish a survey that modifies Portfolio Items.");
            return;
        }

        var surveyConfig = Ext.create('CA.agile.technicalservices.SurveyConfiguration',{
            surveyTitle: this.getSurveyTitle(),
            surveyType: this.getSurveyType(),
            surveyPanels: this.getSurveyPanelConfig()
        });

        if (appMode === this.MODE_ADMIN || !this.getSurveyPanelConfig() || this.getSurveyPanelConfig().length === 0){
            this.launchAdminMode(surveyConfig);
        } else {
            this.launchSurveyMode(appMode === this.MODE_PREVIEW, surveyConfig);
        }
    },
    launchAdminMode: function(surveyConfig){
        this.logger.log('launchAdminMode', surveyConfig);

        this.add({
            xtype: 'rallybutton',
            text: 'Save',
            handler: this.saveConfiguration,
            scope: this
        });

        this.add({
            xtype: 'rallybutton',
            text: 'Preview',
            handler: this.previewConfiguration,
            scope: this
        });

        var adminPanel = this.add({
            xtype: 'surveyconfigurationview',
            surveyPanelCfg: surveyConfig,
            width: '99%'
        });
    },
    previewConfiguration: function(){
        var adminPanel = this.down('surveyconfigurationview');

        this.logger.log('previewConfiguration', adminPanel.getSurveyConfig());
        this.launchSurveyMode(true, adminPanel.getSurveyConfig());

    },
    saveConfiguration: function(){
        var adminPanel = this.down('surveyconfigurationview');

        this.logger.log('saveConfiguration', adminPanel.getSurveyConfig());

    },
    launchSurveyMode: function(preview, surveyConfig){
        this.logger.log('launchSurveyMode', preview, surveyConfig);
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
            columnCfgs: this.surveyDriver.getFetch(),
            height: 450
        });
        grid.on('itemdblclick', this.launchSurvey, this);
    },
    launchSurvey: function(grid, record){
        this.getSurveyBox().removeAll();

        this.logger.log('launchSurvey', record.get('FormattedID'));
        this.down('rallygrid').hide();
        var surveyPanel = this.getSurveyBox().add({
            xtype: 'tssurveypanel',
            width: this.getWidth(),
            surveyConfig: this.surveyDriver.getSurveyConfig(),
            record: record
        });
        surveyPanel.on('submit', this.showSuccess, this);
        surveyPanel.on('failure', this.showErrorNotification, this);
        surveyPanel.on('destroy', this.showGrid, this);
    },
    showGrid: function(){
        if (this.down('rallygrid')){
            this.down('rallygrid').show();
        }
    },
    showSuccess: function(successObj){
        if (!successObj){
            successObj = "Success";
        }

        if (Ext.isString(successObj)){
            Rally.ui.notify.Notifier.show({message: successObj});
        } else {
            Rally.ui.notify.Notifier.showUpdate({artifact: successObj});
        }

    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg });
    },
    addAppMessage: function(msg){
        this.add({
            xtype: 'container',
            html: Ext.String.format('<div class="survey-question">{0}</div>',msg)
        });
    },
    getGridBox: function(){
        return this.down('#grid_box');
    },
    getSurveyBox: function(){
        return this.down('#survey_box');
    },
    getSurveyPanelConfig: function(){
        var panelSetting = this.getSetting('panels');
        if (!panelSetting){
            return null;
        }
        var panels = [];
        return panels;

    },
    getSurveyType: function(){
        return this.getSetting('surveyType');
    },
    getSurveyTitle: function(){
        return this.getSetting('surveyTitle');
    },
    isUserAdmin: function(){
        return CA.agile.technicalservices.Toolbox.isUserWorkspaceAdmin(this.getContext());
    },
    getAppMode: function(){
        return this.getSetting('appMode');
    },
    getSettingsFields: function(){
        var isUserAdmin = this.isUserAdmin(),
            appMode = this.getAppMode(),
            labelWidth = 125,
            settings = [{
                xtype: 'container',
                margin: '0 0 15 0',
                html: '<div class="rally-upper-bold">App Mode</div>'
            },{
                xtype: 'rallyradiofield',
                name: 'appMode',
                fieldLabel: 'Admin',
                labelAlign: 'right',
                boxLabel: '<i>Edit the survey contents in this mode.<i>',
                inputValue: this.MODE_ADMIN,
                value: appMode == this.MODE_ADMIN,
                labelWidth: labelWidth
            },{
                xtype: 'rallyradiofield',
                name: 'appMode',
                fieldLabel: 'Preview',
                labelAlign: 'right',
                boxLabel: '<i>(For Testing Only) The app will NOT modify Portfolio Items in this mode.</i>',
                inputValue: this.MODE_PREVIEW,
                value: appMode == this.MODE_PREVIEW,
                labelWidth: labelWidth
            }];

        if (isUserAdmin){
            settings.push({
                xtype: 'rallyradiofield',
                name: 'appMode',
                fieldLabel: 'Publish (Admin Only)',
                labelAlign: 'right',
                boxLabel: '<i>(For Production Only) The app WILL modify Portfolio Items in this mode.</i>',
                inputValue: this.MODE_PUBLISH,
                value: appMode == this.MODE_PUBLISH,
                labelWidth: labelWidth

            });
        }

        settings.push({
            xtype: 'container',
            margin: '25 0 15 0',
            html: '<div class="rally-upper-bold">Survey Configuration</div>'
        });
        settings.push({
            xtype: 'rallytextfield',
            fieldLabel: 'Survey Title',
            labelAlign: 'right',
            name: 'surveyTitle',
            labelWidth: labelWidth,
            width: 300
        });
        settings.push({
            xtype: 'rallyportfolioitemtypecombobox',
            fieldLabel: 'Portfolio Item Type',
            labelAlign: 'right',
            name: 'surveyType',
            labelWidth: labelWidth,
            value: this.getSurveyType(),
            width: 300
        });
        settings.push({
            xtype: 'textarea',
            fieldLabel: 'Query',
            name: 'queryFilter',
            anchor: '100%',
            cls: 'query-field',
            margin: '0 70 0 0',
            labelAlign: 'right',
            labelWidth: labelWidth,
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
        });

        return settings;
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
