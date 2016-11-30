Ext.define('CA.agile.technicalservices.ExtendedModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function (model) {

                var default_fields = [{
                    name: '__projectAllocations',
                    defaultValue: []
                }];

                var new_model = Ext.define(newModelName, {
                    extend: model,
                    logger: new Rally.technicalservices.Logger(),
                    fields: default_fields,

                    updateTeamInfo: function(planEstimatesByProject, projectHash){
                        this.logger.log('updateTeamInfo', planEstimatesByProject, projectHash);
                        var projectAllocations = [];
                        Ext.Object.each(planEstimatesByProject, function(projectID, planEstimateArray){
                            var projectData = projectHash[projectID];

                            if (projectData){
                                projectAllocations.push({
                                    thisTotal: Ext.Array.sum(planEstimateArray),
                                    projectTotal: Ext.Array.sum(projectData.activePoints),
                                    teamName: projectData.Name,
                                    lineOfBusiness: projectData.lineOfBusiness
                                });
                            }
                        });

                        this.set('__projectAllocations', projectAllocations);
                    }
                });
                deferred.resolve(new_model);
            }
        });
        return deferred;
    }
});