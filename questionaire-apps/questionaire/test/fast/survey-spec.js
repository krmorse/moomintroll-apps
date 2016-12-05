describe("CA.agile.technicalservices.Survey", function() {

    var surveyConfig,
        survey;
    beforeEach(function() {
        surveyConfig = {
            model: 'PortfolioItem/Initiative',
            fetch: ['FormattedID','Name'],
            filters: [],

            title: 'This is my configurable survey title',
            instructions: 'These are instructions for filling out the survey.',

            //startQuestions: ['animals', 'cars'],
            startContainer: 'things',


            questionMap: {
                things: {
                    animals: {
                        cats: {
                            "maine-coon": null,
                            tabby: null,
                            persian: null
                        },
                        dogs: {
                            poodles: null,
                            'golden-retrievers': null,
                            mutts: null,
                            labradoodles: null
                        },
                        birds: {
                            cardinal: null,
                            oriole: null
                        }
                    },
                    cars: {
                        carDescription: null
                    }
                }
            },

            questions: {
                things: {
                    childType: 'surveycontainerradio',
                    childInstructions: 'Please select your favorite kind of thing:'
                },
                carDescription:{
                    question: 'Please describe your ideal car',
                    exampleValue: 'Expected Description:<br/><br/>I like vintage airstream campers.' ,
                    updates: [{
                        field: 'Description',
                        value: '{value}'
                    }]
                },
                'animals': {
                    question: 'I like animals more than cars',
                    updates: [{
                        Name: "I like animals",
                        Description: "I like animals more than cars"
                    }],
                    childInstructions: 'Please select your favorite kind of animal',
                    childType: 'surveycontainerradio'
                },
                'cars': {
                    question: 'I like cars more than animals',
                    updates: [{
                        Name: "I like cars",
                        Description: "I like cars more than animals"
                    }],
                    childInstructions: null,
                    childType: 'surveycontainerdescriptiontemplate'
                },
                'cats': {
                    question: 'I like cats the best',
                    childInstructions: 'Please select your favorite kind of cat',
                    childType: 'surveycontainerradio'
                },
                'dogs': {
                    question: 'I like dogs the most',
                    childInstructions: 'Please select your favorite kind of dog',
                    childType: 'surveycontainerradio'
                },
                'birds': {
                    question: 'I like birds',
                    childInstructions: 'Please select your favorite kind of bird',
                    childType: 'surveycontainerradio'
                },
                'maine-coon': {
                    question: 'Maine-coons with their squeaky voices and huge tails are the best'
                },
                'tabby': {
                    question: 'Tabby have the best coloring'
                },
                'persian': {
                    question: 'Persian cats have attitude'
                },
                'poodles': {
                    words: 'Poodles are awesome because they dont shed'
                },
                'golden-retrievers': {
                    words: 'Golden Retrievers are so loyal and sweet.'
                },
                'mutts': {
                    question: 'Mutts are the best'
                },
                labradoodles: {
                    question: 'Labradoodles look like poodles'
                },
                'cardinal': {
                    question: 'Cardinals are bold and red'
                },
                'oriole': {
                    question: 'Orioles are a neat bird, but named after a baseball team that loses to the Pirates all the time'
                }
            }
        };
        survey = Ext.create('CA.agile.technicalservices.Survey', surveyConfig);
    });


    it("it should initialize with survey config",function(){
        expect(survey.getRootKey()).toBe('things');
    });
    it("it should return the expected first question",function(){
        var initialContainerConfig = survey.getInitialContainerConfig();
        expect(initialContainerConfig.xtype).toBe('surveycontainerradio');
        expect(initialContainerConfig.questions.length).toBe(2);
        expect(survey.getID()).toBe('Unknown');
    });
    it("should return the next question",function(){
        survey.getInitialContainerConfig();
        var nextQuestion = survey.getNextContainerConfig('things','animals')
        expect(nextQuestion.questions.length).toBe(3);
        var nextQuestion = survey.getNextContainerConfig('animals','cats')
        expect(nextQuestion.questions.length).toBe(3);
    });
    it("should return the next question",function(){
        survey.getInitialContainerConfig();
        var nextQuestion = survey.getNextContainerConfig('things','animals')
        expect(nextQuestion.questions.length).toBe(3);
        var nextQuestion = survey.getNextContainerConfig('animals','dogs')
        expect(nextQuestion.questions.length).toBe(4);
    });
    it("should return the next question",function(){
        survey.getInitialContainerConfig();
        var nextQuestion = survey.getNextContainerConfig('things','animals')
        expect(nextQuestion.questions.length).toBe(3);
        var nextQuestion = survey.getNextContainerConfig('animals','birds')
        expect(nextQuestion.questions.length).toBe(2);
    });


});
