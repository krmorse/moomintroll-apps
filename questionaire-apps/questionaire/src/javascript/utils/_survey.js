Ext.define('CA.agile.technicalservices.Survey',{
    constructor: function(config){
        Ext.apply(this, config);
        this.questionPath = [];
        this.panelPath = [];
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
    getNextContainerConfig: function(currentContainerKey,selectedChildKey, containerValue){
        //get the next container in the tree.
        this.questionPath.push(selectedChildKey);
        this.questions[selectedChildKey].value = containerValue;
        return this.getQuestionConfig(selectedChildKey);
    },
    getPreviousContainerConfig: function(currentContainerKey,selectedChildKey, containerValue){
        if (containerValue){
            this.questions[selectedChildKey].value = containerValue;
        }
        //now remove the last element from the path
        this.questionPath.pop();
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
                hasChildren = (child.children && child.children.length > 0);
                child.value = (question.value === child.key);
                children.push(child);
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
    submit: function(containerValue){
        var deferred = Ext.create('Deft.Deferred');
       // this.panelPath.push(selectedChildKey);
        this.setValue(containerValue);
       // this.questionPath.push(selectedChildKey);
       // this.questions[selectedChildKey].value = containerValue;

        var updates = {};
        Ext.Array.each(this.panelPath, function(key){
            var panel = this.panels[key];
            if (panel.updates){
                Ext.Object.each(panel.updates, function(field,value){
                    if (Ext.isString(value)){
                        value = value.replace(/\{value}/g, panel.value);
                    }
                    updates[field] = value
                });
            }
            if (panel.options){
                Ext.Array.each(panel.options, function(opt){
                    if (opt.nextKey === panel.value && opt.updates){
                        Ext.Object.each(opt.updates, function(field,value){
                            updates[field] = value
                        });
                    }
                });
            }
        }, this);
        //Ext.Array.each(this.questionPath, function(key){
        //    var question = this.questions[key];
        //    if (question.updates){
        //        Ext.Object.each(question.updates, function(field,value){
        //            if (Ext.isString(value)){
        //                value = value.replace(/\{value}/g, question.value);
        //            }
        //            updates[field] = value
        //        });
        //    }
        //}, this);

        console.log('submit', updates);
        Ext.Object.each(updates, function(field,value){
            this.record.set(field, value);
        }, this);

        this.record.save().then({
            success: function(record){
                deferred.resolve(record);
            },
            failure: function(){
                deferred.reject('Failed to save changes');
            },
            scope: this
        });
        return deferred;
    },
    isFirstButton: function(){
        return (this.questionPath.length === 1);
    },
    isFirst: function(){
        return (this.panelPath.length === 1);
    },
    isLast: function(selectedValue){
        var key = this.getCurrentPanelKey();

        var panelCfg = this.panels[key],
            isLast = true;

        console.log('isLast', key, panelCfg, selectedValue);
        if (panelCfg){
            if (panelCfg.nextKey){
                return false;
            }

            Ext.Array.each(panelCfg.options || [], function(opt){
                if (opt.nextKey && this.panels[opt.nextKey] &&
                    (!selectedValue || selectedValue === opt.nextKey)){
                    isLast = false;
                }
                return isLast;
            }, this);
        }
        return isLast;
    },
    setValue: function(containerValue){
        var containerKey = this.getCurrentPanelKey();
        this.panels[containerKey].value = containerValue;
    },

    getPanelCfg: function(key){
        if (!key){
            key = this.startContainer;
            this.panelPath = [];
        }
        if (!Ext.Array.contains(this.panelPath, key)){
            this.panelPath.push(key);
        }
        return this.panels[key];
    },
    getCurrentPanelKey: function(){
        return this.panelPath[this.panelPath.length-1];
    },
    getPreviousPanelCfg: function(){
        this.panelPath.pop();
        var key = this.getCurrentPanelKey();
        return this.getPanelCfg(key);
    }
});