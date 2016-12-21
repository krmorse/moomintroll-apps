/*
 * 
 * For putting on the settings panel -- allows for a dropdown  representing a field and one representing its values
 * 
 */
Ext.define('CA.technicalservices.settings.FieldValuePairField', {
    extend:'Ext.form.field.Base',
    alias: 'widget.tsfieldvaluepairfield',

    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',
    store: undefined,
    
    /**
     * @cfg {String} blankText
     */
    blankText : 'Use + to add a field/value pair',

    labelAlign: 'top',
    
    /**
     * @cfg {String|Rally.data.wsapi.Model} model (req)
     * Model from which the fields will be available
     */
    model: null,

    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },
    
    initComponent: function(){
        this.callParent();
        this.addEvents('ready');

        if ( Ext.isEmpty(this.model) ) {
            console.error('Must supply model for CA.technicalservices.settings.FieldValuePairField');
            return;
        }
        
    },
    
    onRender: function() {
        this.callParent(arguments);
        this._buildFieldValueGrid();        
    },
    
    _buildFieldValueGrid: function() {
        var container = Ext.create('Ext.container.Container',{
            layout: { type:'hbox' },
            renderTo: this.inputEl,
            minHeight: 50,
            minWidth: 50
        });
        
        container.doLayout();
                
        var decoded_value = [];
        if (this.initialConfig && this.initialConfig.value && !_.isEmpty(this.initialConfig.value)){
            if (!Ext.isObject(this.initialConfig.value)){
                decoded_value = Ext.JSON.decode(this.initialConfig.value);
            } else {
                decoded_value = this.initialConfig.value;
            }
            decoded_value = Ext.Array.map(decoded_value, function(val) {
                return { "FieldName": val.property, "FieldValue": val.value};
            });
        }
       
        var empty_text = "No selections";
        
        console.log('initial config', this._value, this.initialConfig, decoded_value);

        var custom_store = Ext.create('Ext.data.Store',{
            fields: ['FieldName','FieldValue'],
            data: decoded_value
        });
        
        var grid_width = Math.min(container.getWidth(true)-50,500);

        this._grid = container.add({
            xtype:'rallygrid',
            autoWidth: true,
            columnCfgs: this._getColumns(),
            showRowActionsColumn:false,
            showPagingToolbar: false,
            store: custom_store,
            height: 150,
            margin: 3,
            width: grid_width,
            emptyText: empty_text,
            editingConfig: {
                publishMessages: false
            }
        });
        
        
        container.add({
            xtype: 'rallybutton',
            text: '+',
            margin: '3 0 0 10',
            listeners: {
                scope: this,
                click: function(){
                    Ext.create('CA.technicalservices.FieldValuePickerDialog',{
                        autoShow: true,
                        width: 250,
                        heigh: 250,
                        model: this.model,
                        listeners: {
                            scope: this,
                            itemschosen: function(new_data){
                                this._grid.getStore().add(new_data);
                            }
                        }
                    });                
                }
            }
        });
        this.fireEvent('ready', true);

    },
    
    _removeValue: function() {
        this.grid.getStore().remove(this.record);
    },
    
    _getColumns: function() {
        var me = this;
        return [
        {
            xtype: 'rallyrowactioncolumn',
            scope: this,
            rowActionsFn: function(record){
                return  [
                    {text: 'Remove', record: record, handler: me._removeValue, grid: me._grid }
                ];
            }
        },
        {
            text: 'Field Name',
            dataIndex: 'FieldName',
            flex: 1,
            editor: false
        },
        {
            text: 'Field Value',
            dataIndex: 'FieldValue',
            flex: 1,
            editor: false
        }
        ];
    },
    
    _getSettingValue: function() {
        var store = this._grid.getStore();

        var selections = [];
        store.each(function(record) {
            var filter = {property:record.get('FieldName'),value: record.get('FieldValue')};
            selections.push(filter);
        }, this);
        
        return selections;
    },
    
    getSubmitData: function() {
        var data = {};
        data[this.name] = Ext.JSON.encode(this._getSettingValue());
        return data;
    },
    
    setValue: function(value) {
        console.log('setValue', value);
        this.callParent(arguments);
        this._value = value;
    }
});