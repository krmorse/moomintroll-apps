Ext.define('CA.agile.technicalservices.SurveyDriver', {
    mixins: {
        observable: 'Ext.util.Observable'
    },

    surveyData: null,


    constructor: function (config) {
        this.mixins.observable.constructor.call(this, config);

        this._fetchSurveyData(config.surveyConfig).then({
            success: function(data){
                this.surveyData = data;
                this.fireEvent('ready', this);
            },
            failure: function(msg){
                this.fireEvent('problem', msg);
            },
            scope: this
        });
    },
    getFetch: function(){
        return this.surveyData && this.surveyData.fetch || ['FormattedID','Name'];
    },
    getModel: function(){
        return this.surveyData && this.surveyData.model || 'HierarchicalRequirement';
    },
    getFilters: function(){
        return this.surveyData && this.surveyData.filters || [];
    },
    getTitle: function(){},
    getSurveyConfig: function(){
        return this.surveyData;
    },
    getInstuctions: function(){},
    getRootQuestions: function () {
        if (!this.rootQuestions) throw 'DecisionTree: no initial choice(s) specified';
        return this.getQuestions(this.rootQuestions);
    },
    getQuestions: function (questions) {

        if (!questions) return [];
        var list = [];
        for (var i = 0, ln = questions.length; i < ln; i++) {
            var childChoice = this.getQuestion(questions[i]);
            list.push(childChoice);
        }
        return list;

    },
    getQuestion: function (questionKey) {
        if (!(questionKey in this.questions)) return false;
        return this.questions[questionKey];
    },
    getNextQuestions: function(thisQuestion){
        if (!(thisQuestion in this.questions)) return false;
        if (!('children' in this.questions[thisQuestion])) return false;

        var childIds = this.questions[thisQuestion].children;
        return this.getQuestions(childIds);
    },
    _fetchSurveyData: function(config){
        var deferred = Ext.create('Deft.Deferred');

        //todo: retrieve this from preferences
        // add clone to keep from reusing values
        deferred.resolve(Ext.clone(config));

//        deferred.resolve(Ext.create('CA.agile.technicalservices.SurveyConfiguration'));

        return deferred.promise;
    }
});
