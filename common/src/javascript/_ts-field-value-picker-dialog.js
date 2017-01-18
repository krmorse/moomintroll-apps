Ext.define('CA.technicalservices.FieldValuePickerDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.tsfieldvaluepickerdialog',

    minWidth: 250,
    minHeight: 250,
    
    layout: 'vbox',
    closable: true,
    draggable: true,

    config: {
        /**
         * @cfg {String}
         * Title to give to the dialog
         */
        title: 'Choose Field & Value',

        /**
         * @cfg {String}
         * Text to be displayed on the button when selection is complete
         */
        selectionButtonText: 'Done',
        
        /**
         * @cfg {String} model (Required)
         * 
         */
        model: null
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },

    selectionCache: [],

    initComponent: function() {
        this.callParent(arguments);

        this.addCls(['chooserDialog', 'chooser-dialog']);
    },

    beforeRender: function() {
        this.callParent(arguments);

        this.addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    itemId: 'doneButton',
                    text: this.selectionButtonText,
                    cls: 'primary rly-small',
                    scope: this,
                    disabled: true,
                    userAction: 'clicked done in dialog',
                    handler: function() {
                        this.fireEvent('itemschosen', this.getSelectedRecords());
                        this.close();
                    }
                },
                {
                    xtype: 'rallybutton',
                    text: 'Cancel',
                    cls: 'secondary rly-small',
                    handler: this.close,
                    scope: this,
                    ui: 'link'
                }
            ]
        });

        this._addFieldSelector();
    },

    _addFieldSelector: function() {
        this.fieldSelector = this.add({
            xtype:'rallyfieldcombobox',
            model:this.model,
            fieldLabel: 'Field:',
            labelAlign: 'top',
            width: 175,
            margin: 10,
            _isNotHidden: function(field) {
                //if ( field.hidden ) { return false; }

                var attribute_definition = field.attributeDefinition;
                if ( Ext.isEmpty(attribute_definition) ) { return false; }
                
                if ( attribute_definition.AttributeType == "BOOLEAN" ) { return true; }
                if ( attribute_definition.AttributeType == "RATING" )  { return true; }
                if ( attribute_definition.AttributeType == "STRING" && attribute_definition.Constrained == true ) { return true; }
                
                console.log(field.name, attribute_definition);
                return false;
            },
            
            listeners: {
                change: this._addValueSelector,
                scope: this
            }
        });
    },

    _addValueSelector: function() {
        if ( this.valueSelector ) { this.valueSelector.destroy(); }
        this.down('#doneButton').setDisabled(true);
        
        this.valueSelector = this.add({
            xtype:'rallyfieldvaluecombobox',
            model: this.model,
            field: this.fieldSelector.getValue(),
            fieldLabel: 'Value:',
            labelAlign: 'top',
            width: 175,
            margin: 10,
            listeners: {
                change: function() { this.down('#doneButton').setDisabled(false); },
                scope: this
            }
        });
    },
    
    getSelectedRecords: function() {
        return {
            FieldName: this.fieldSelector.getValue(),
            FieldValue: this.valueSelector.getValue()
        }
    }

});
