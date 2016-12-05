Ext.define('CA.agile.technicalservices.utils.ProjectUtilities',{

    fetch: ['ObjectID','Name','Parent'],
    mixins: {
        observable: 'Ext.util.Observable'
    },
    constructor: function(config){
        this.mixins.observable.constructor.call(this, config);

        var fetch = ['ObjectID','Name','Parent']
        if (config.fetch){
            fetch = Ext.Array.merge(fetch, config && config.fetch || []);
        }
        this.currentProject = config.currentProject;

        Ext.create('Rally.data.wsapi.Store',{
            model: 'Project',
            fetch: fetch,
            limit: Infinity,
            context: {project: null},
            compact: false
        }).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    this._buildProjectParentHash(records);
                } else {
                    this.fireEvent('onerror', "Error fetching projects: " + operation.error && operation.error.errors.join(','));
                }
            },
            scope: this
        });
    },
    _buildProjectParentHash: function(records){

        var projectHash = {};
        Ext.Array.each(records, function(r){
            projectHash[r.get('ObjectID')] = r.getData();
        });
        this.projectHash= projectHash;
        this.fireEvent('ready');
    },
    //getProjectAncestor: function(projectID, relativeProjectLevel){
    //    var actualProjectLevel =
    //
    //    var parent = this.projectHash[projectID].Parent && this.projectHash[projectID].Parent.ObjectID || null,
    //        ancestry = this.projectHash[projectID] && this.projectHash[projectID].ancestors;
    //
    //    if (!ancestry){
    //        ancestry = [projectID];
    //        if (parent){
    //            do {
    //                ancestry.unshift(parent);
    //                parent = this.projectHash[parent] &&
    //                    this.projectHash[parent].Parent &&
    //                    this.projectHash[parent].Parent.ObjectID || null;
    //
    //            } while (parent);
    //        }
    //        this.projectHash[projectID].ancestors = ancestry;
    //    }
    //    if (ancestry.length >= projectLevel){
    //        return ancestry[projectLevel - 1];
    //    }
    //    return null;
    //},
    getAncestry: function(projectID){
        var parent = this.projectHash[projectID].Parent && this.projectHash[projectID].Parent.ObjectID || null,
            ancestry = this.projectHash[projectID] && this.projectHash[projectID].ancestors;

        if (!ancestry){
            ancestry = [projectID];
            if (parent){
                do {
                    ancestry.unshift(parent);
                    parent = this.projectHash[parent] &&
                        this.projectHash[parent].Parent &&
                        this.projectHash[parent].Parent.ObjectID || null;

                } while (parent);
            }
            this.projectHash[projectID].ancestors = ancestry;
        }
        return ancestry;
    },
    getCurrentProjectLevel: function(){
        if (!this.currentProjectLevel){
            this.currentProjectLevel = this.getProjectLevel(this.currentProject);
        }
        return this.currentProjectLevel;
    },
    getProjectAncestor: function(projectID, absoluteProjectLevel){
        var ancestry = this.getAncestry(projectID);

        if (ancestry.length >= absoluteProjectLevel){
            return ancestry[absoluteProjectLevel - 1];
        }
        return null;
    },
    getProjectName: function(projectID){
        return this.projectHash[projectID] &&  this.projectHash[projectID].Name || "Unknown";
    },
    getProjectLevel: function(projectID){
        var ancestory = this.getAncestry(projectID);
        return ancestory.length;
    }
});