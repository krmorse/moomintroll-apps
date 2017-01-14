Ext.define('CA.agile.technicalservices.SurveyConfiguration',{
    mixins: {
        observable: 'Ext.util.Observable'
    },
    /**
     * Types of panels
     */
    TYPE_CHOICE: 'choice',
    TYPE_TEXT_ENTRY: 'text',

    model: 'PortfolioItem/Initiative',
    fetch: ['FormattedID','Name'],

    title: 'Financial Survey',

    startContainer: 'root',

    filters: null,
    
    constructor: function (config) {

        this.mixins.observable.constructor.call(this, config);

        this.surveyTitle = config.surveyTitle;
        this.surveyType = config.surveyType;

        Rally.data.PreferenceManager.load({
            appID: this.getAppId(),
            success: function(prefs) {
                if (prefs.panels){
                    this.panels = Ext.JSON.decode(prefs.panels);
                } else {
                    this.panels = {};
                }
                this.fireEvent('ready', this);
            },
            scope: this
        });
    },

    getAppId: function(){
        return Rally.getApp().getAppId();
    },
    saveConfiguration: function(){
        //clear out values
        Ext.Object.each(this.panels, function(panel){
            panel.value = '';
        });

        var panelSetting = Ext.JSON.encode(this.panels);
        Rally.data.PreferenceManager.update({
            appID: this.getAppId(),
            settings: {
                panels: panelSetting
            },
            scope: this,
            success: function(prefs) {
                this.fireEvent('surveysaved', "Survey Settings saved successfully.");
            }
        });
    },
    getPanels: function(){
        if (!this.panels || Ext.Object.isEmpty(this.panels) || !this.panels.root){
            this.panels = {
                root: {
                    id: 'root',
                    text: '',
                    type: this.TYPE_CHOICE,
                    options: []
                }
            };
        }
        return this.panels;
    },
    getPanel: function(panelId){
        return this.panels[panelId];
    },
    setPanel: function(panelId, panelCfg){
        this.panels[panelId] = panelCfg;
    },
    removePanel: function(panelId){
        var panel = this.getPanel(panelId);
        if ( !panel ) {
            console.log('Cannot find panel with id:', panelId);
            return;
        }
        
        delete this.panels[panelId];
        return;
    },
    
    /**
     * panels:
     *     hash of objects representing a panel in the survey
     *
     *     key: unique panel identifier
     *     type:  type of panel (choice or text entry)  see above for options
     *     text: the text of the question at the top of the panel
     *
     *     choices:  null for anything other than choice type
     *     ** choice object **
     *     {
     *          text: answer text
     *          actions:  []  array of actions to be taken when this choice is selected see below for details
     *     }
     *
     *     textEntryFieldType:  type of field for text entry, null for choices
     *     actions:  []  array of actions to be taken when next is clicked;  If this is a choice, then the actions shoudl be in the choice.  If they are not, this field will override any choice
     *
     *     ** action object **
     *     {
     *          type: update or next panel,
     *          field: (for update, null for next panel)
     *          value: for next panel, the name of the next panel.  Null for the end of the survey,
     *                  for update, the value to update the field with.  If {value}, then it will take the value of the control
     *
     *     }
     *
     *
     */


    panels: {
        root: {
            id: 'root',
            type: 'choice',
            text: 'Please select your favorite kind of thing:',
            options: [{
                text: 'I like animals',
                nextSection: 'animals',
                field: null,
                value: null
            },{
                text: 'I like cars',
                nextSection: 'cars',
                field: null,
                value: null
            }],
            optionIndex: null
        },
        animals: {
            id: 'animals',
            text: 'Please select your favorite kind of animal',
            type: 'choice',
            options: [{
                text: 'I like dogs',
                nextSection: 'dogs',
                field: null,
                value: null
            },{
                text: 'I like cats',
                nextSection: null,
                field: null,
                value: null
            },{
                text: 'I like birds',
                nextSection: 'birds',
                field: null,
                value: null
            }],
            optionIndex: null
        },
        cars: {
            id: 'cars',
            text: 'Please describe your ideal car',
            type: 'text',
            field: 'Description',
            nextSection: 'carColor',
            exampleValue: "Suggested Template:<br/><br/>I want a car with 4 seats and a steering wheel."
        },
        carColor: {
            id: 'carColor',
            text: 'what color would your ideal car be?',
            type: 'text',
            field: 'Notes',
            nextSection: null
        },
        dogs: {
            text: 'Please select your favorite kind of dog',
            type: 'choice',
            id: 'dogs',
            options: [{
                text: 'I like mutts',
                nextSection: 'mutts',
                field: "Name",
                value: 'I like mutts'
            },{
                text: 'I like poodles',
                nextSection: 'poodles',
                field: "Name",
                value: 'I like poodles'
            }],
            optionIndex: null
        }
    },


    getRootConfig: function(){
        if (!this.panels || Ext.Object.isEmpty(this.panels) || !this.panels.root){
            this.panels = {
                root: {
                    key: 'root',
                    text: '',
                    type: this.TYPE_CHOICE,
                    choices: []
                }
            };
        }
        return this.panels.root;
    }
});