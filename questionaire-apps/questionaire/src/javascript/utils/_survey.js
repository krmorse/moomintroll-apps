Ext.define('CA.agile.technicalservices.Survey',{
    constructor: function(config){
        Ext.apply(this, config);
        this.questionPath = [];
        console.log('CA.agile.technicalservices.Survey', this);
    },
    getTitle: function(){
        return this.title;
    },
    getInstructions: function(){
        return this.instructions;
    },
    setRecord: function(record){
        this.record = record;
    },
    getID: function(){
        console.log('getID', this.record.get('FormattedID'));
        return this.record && this.record.get('FormattedID') || "Unknown";
    },
    getRootKey: function(){
        return Ext.Object.getKeys(this.questionMap)[0];
    },
    getInitialContainerConfig: function(){
        var containerKey = this.startContainer;
        this.questionPath = [containerKey];
        return this.getQuestionConfig(containerKey);
    },
    getNextContainerConfig: function(currentContainerKey,containerValue){
        //get the next container in the tree.
        console.log('getNextContainerConfig', currentContainerKey, containerValue);
        this.questionPath.push(containerValue);
        this.questions[currentContainerKey].value = containerValue;
        return this.getQuestionConfig(containerValue);
    },
    getPreviousContainerConfig: function(currentContainerKey, containerValue){

        this.questions[currentContainerKey].value = containerValue;
        //now remove the current index from the path
        this.questionPath = this.questionPath.splice(this.questionPath.length-1,1);
        return this.getQuestionConfig(this.questionPath[this.questionPath.length-1]);
    },
    getQuestionMap: function(questionKey){
        var map = this.questionMap;
        Ext.Array.each(this.questionPath, function(key){
            map = map[key] || null;
            if (!map){ return false; }
            if (questionKey === key){
                return false;
            }
        });
        return map;
    },
    getQuestionConfig: function(key){
        var question = this.questions[key],
            hasChildren = false;
        if (!question){
            return null;
        }

        var childrenKeys = question.children || [],
            children = [];
        Ext.Array.map(childrenKeys, function(c){
            var child = this.questions[c];
            if (child){
                child.key = c;
            }
            children.push(child);
            if (child.children && child.children.length > 0){
                hasChildren = true;
            }
        }, this);

        return {
            xtype: question.childType,
            instructions: question.childInstructions,
            questions: children,
            record: this.record,
            key: key,
            hasChildren: hasChildren
        };
    },
    submit: function(currentContainerKey,containerValue){
        var deferred = Ext.create('Deft.Deferred');
        this.questionPath.push(containerValue);
        this.questions[currentContainerKey].value = containerValue;

        var updates = {};
        Ext.Array.each(this.questionPath, function(key){
            var question = this.questions[key];
            if (question.updates){
                Ext.Object.each(question.updates, function(field,value){
                    //if (/\{value\}/.test(value)){
                    //    value = question.value;
                    //}
                    console.log('updates', field, value);
                    updates[field] = value
                });
            }
        }, this);
        console.log('submit', updates);

        deferred.resolve(this.record);

        return deferred;
    },
    isFirstButton: function(){
        return (this.questionPath.length === 1);
    }
});