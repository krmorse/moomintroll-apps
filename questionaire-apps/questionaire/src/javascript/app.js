Ext.define("questionaire", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    padding: 10,
    
    defaults: { margin: 10 },

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

        var config = {
            surveyTitle: this.getSurveyTitle(),
            surveyType: this.getSurveyType() ,
            listeners: {
                ready: this.launchApp,
                scope: this,
                initerror: this.showErrorNotification,
                surveysaved: this.showSuccess
            }
        };
        
        var setting_filter = this.getSetting('queryFilter');
        this.logger.log("Setting Filter: ", setting_filter);

        if ( ! Ext.isEmpty(setting_filter)) {
            setting_filter = setting_filter.replace(/\{user\}/,this.getContext().getUser()._ref);
            config.filters = Rally.data.wsapi.Filter.fromQueryString(setting_filter);
        }
        var surveyConfig = Ext.create('CA.agile.technicalservices.SurveyConfiguration',config);
    },
    launchApp: function(surveyConfig){
        var appMode = this.getAppMode();
        this.logger.log('launchApp', surveyConfig);

        if (appMode === this.MODE_ADMIN){ // || !this.getSurveyPanelConfig() || this.getSurveyPanelConfig().length === 0){
            this.launchAdminMode(surveyConfig);
        } else {
            this.launchSurveyMode(appMode === this.MODE_PREVIEW, surveyConfig);
        }
    },
    launchAdminMode: function(surveyConfig){
        this.logger.log('launchAdminMode', surveyConfig);

        this.removeAll();

//        this.add({
//            xtype: 'rallybutton',
//            text: 'Save',
//            width: 100,
//            handler: this.saveConfiguration,
//            scope: this
//        });

        this.add({
            xtype: 'rallybutton',
            text: 'Preview',
            width: 100,
            handler: this.previewConfiguration,
            scope: this
        });

        this.add({
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
    saveConfiguration: function(surveyConfig){
        
        if (!surveyConfig || surveyConfig.xtype == "rallybutton" ){
            var adminPanel = this.down('surveyconfigurationview');
            surveyConfig = adminPanel.getSurveyConfig();
        }

        this.logger.log('saveConfiguration', surveyConfig);
        if (surveyConfig){
            surveyConfig.saveConfiguration();
        }

    },
    launchSurveyMode: function(preview, surveyConfig){
        this.logger.log('launchSurveyMode', preview, surveyConfig);

        this.addBoxes(preview);

        this.preview = preview;
        var driver = Ext.create('CA.agile.technicalservices.SurveyDriver',{
            surveyConfig: surveyConfig
        });
        this.initializeApp(driver, surveyConfig);
    },
    initializeApp: function(driver, surveyConfig){
        this.surveyDriver = driver;
        this.logger.log('initializeApp', this.surveyDriver);
        if (this.preview){

            if (this.getAppMode() === this.MODE_ADMIN){
                this.getPreviewBox().add({
                    xtype: 'rallybutton',
                    text: 'Edit Survey',
                    width: 100,
                    handler: function(){
                        this.launchAdminMode(surveyConfig);
                    },
                    scope: this
                });
                this.getPreviewBox().add({
                    xtype: 'rallybutton',
                    text: 'Save',
                    width: 100,
                    handler: function(){
                        this.saveConfiguration(surveyConfig);
                    },
                    scope: this
                });

            }
            this.getPreviewBox().add({
                xtype: 'container',
                html: '<div class="survey-question"  style="color:red;">Preview Mode - no records will be updated.</div>'
            });

        }
        var grid = this.getGridBox().add({
            xtype: 'rallygrid',
            storeConfig: {
                model: this.surveyDriver.getModel(),
                fetch: this.surveyDriver.getFetch(),
                filters: this.surveyDriver.getFilters(),
                listeners: {
                    scope: this,
                    load: function(store,records,successful) {
                        if ( !successful ) { 
                            this.showErrorNotification('Problem loading records.  Please check query.');
                        }
                    }
                }
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
            surveyDriver: this.surveyDriver,
            surveyConfig: this.surveyDriver.getSurveyConfig(),
            record: record,
            preview: this.preview
        });
        surveyPanel.on('submit', this.showSuccess, this);
        surveyPanel.on('failure', this.showErrorNotification, this);
        surveyPanel.on('destroy', this.showGrid, this);
    },
    addBoxes: function(preview){
        this.removeAll();
        if (preview){
            this.add({xtype:'container',itemId:'preview_box',flex:1,layout:'hbox'});
        }
        this.add({xtype:'container',itemId:'grid_box', flex: 1});
        this.add({xtype:'container',itemId:'survey_box'});
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
            Rally.ui.notify.Notifier.show({message: successObj, allowHTML: true});
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
    getPreviewBox: function(){
        return this.down('#preview_box');
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
            surveyType = this.getSurveyType(),
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
        //settings.push({
        //    xtype: 'rallyportfolioitemtypecombobox',
        //    fieldLabel: 'Portfolio Item Type',
        //    labelAlign: 'right',
        //    name: 'surveyType',
        //    labelWidth: labelWidth,
        //    value: surveyType,
        //    width: 300,
        //    listeners: {
        //        ready: function(cb){
        //            console.log('ready', surveyType);
        //            cb.setValue(surveyType);
        //        }
        //    }
        //});
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
            validateOnBlur: true,
            validateOnChange: true,
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
