Ext.define('CA.agile.technicalservices.SurveyConfiguration',{

    model: 'PortfolioItem/Initiative',
    fetch: ['FormattedID','Name'],
    filters: [],

    title: 'Financial Survey',
    instructions: null,

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
                    goldenRetrievers: null,
                    mutts: null
                },
                birds: {
                    "blue-jay": null,
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
            childInstructions: 'Please select your favorite kind of thing:',
            children: ['animals','cars'],
            key: 'things'
        },
        carDescription:{
            question: 'Please describe your ideal car',
            exampleValue: 'Expected Description:<br/><br/>I like vintage airstream campers.' ,
            updates: [{
                field: 'Description',
                value: '{value}'
            }],
            field: 'Description',
            key: 'carDescription'

        },
        'animals': {
            question: 'I like animals more than cars',
            updates: {
                Name: "I like animals",
                Description: "I like animals more than cars"
            },
            childInstructions: 'Please select your favorite kind of animal',
            childType: 'surveycontainerradio',
            children: ['cats','dogs','birds'],
            key: 'animals'
        },
        'cars': {
            question: 'I like cars more than animals',
            updates: {
                Name: "I like cars",
                Description: "I like cars more than animals"
            },
            childInstructions: "Please describe your ideal car",
            childType: 'surveytypedescriptiontemplate',
            children: ['carDescription'],
            key: 'cars'
        },
        'cats': {
            question: 'I like cats the best',
            childInstructions: 'Please select your favorite kind of cat',
            childType: 'surveycontainerradio',
            children: ["maine-coon",'tabby','persian'],
            key: 'cats',
            updates: {
                Name: "I like cats",
                Description: "I like cats"
            }
        },
        'dogs': {
            question: 'I like dogs the most',
            childInstructions: 'Please select your favorite kind of dog',
            childType: 'surveycontainerradio',
            children: ['poodles','goldenRetrievers','mutts'],
            key: 'dogs',
            updates: {
                Name: "I like dogs",
                Description: "I like dogs"
            }
        },
        'birds': {
            question: 'I like birds',
            childInstructions: 'Please select your favorite kind of bird',
            childType: 'surveycontainerradio',
            children: ['blue-jays','cardinals','orioles'],
            key: 'birds',
            updates: {
                Name: "I like birds",
                Description: "I like birds"
            }
        },
        'maine-coon': {
            question: 'Maine-coons with their squeaky voices and huge tails are the best',
            key: 'maine-coon',
            updates: {
                Description: "Maine-coons with their squeaky voices and huge tails are the best"
            }
        },
        'tabby': {
            question: 'Tabby have the best coloring',
            key: 'tabby',
            updates: {
                Description: "Tabby have the best coloring"
            }
        },
        'persian': {
            question: 'Persian cats have attitude',
            key: 'persian',
            updates: {
                Description: "Persian cats have attitude"
            }
        },
        'poodles': {
            question: 'Poodles are awesome because they dont shed',
            key: 'poodles',
            updates: {
                Description: "Poodles are awesome because they dont shed"
            }
        },
        'goldenRetrievers': {
            question: 'Golden Retrievers are so loyal and sweet.',
            key: 'goldenRetrievers',
            updates: {
                Description: 'Golden Retrievers are so loyal and sweet.'
            }
        },
        'mutts': {
            question: 'Mutts are the best',
            key: 'mutts',
            updates: {
                Description: 'Mutts are the best'
            }
        },
        'blue-jay': {
            question: 'Blue jays have the most beautiful colors',
            key: 'blue-jay',
            updates: {
                Description: 'Blue jays have the most beautiful colors'
            }
        },
        'cardinal': {
            question: 'Cardinals are bold and red',
            key: 'cardinal',
            updates: {
                Description: 'Cardinals are bold and red'
            }
        },
        'oriole': {
            question: 'Orioles are a neat bird, but named after a baseball team that loses to the Pirates all the time',
            key: 'oriole',
            updates: {
                Description: 'Orioles are a neat bird, but named after a baseball team that loses to the Pirates all the time'
            }
        }
    }
});