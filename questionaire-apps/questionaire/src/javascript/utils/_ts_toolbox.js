Ext.define('CA.agile.technicalservices.Toolbox',{
    singleton: true,

    isUserWorkspaceAdmin: function(context){

        var isAdmin = false,
            permissions = context.getPermissions().userPermissions,
            currentWorkspace = context.getWorkspace().ObjectID;

        Ext.Array.each(permissions, function(permission) {
            if (permission.Role === "Subscription Admin") {
                isAdmin = true;
                return false;
            }
            var permissionOid = Rally.util.Ref.getOidFromRef(permission._ref);
            if (permission.Role === "Workspace Admin" && permissionOid === currentWorkspace) {
                isAdmin = true;
                return false;
            }
        });
        return isAdmin;
    }
});