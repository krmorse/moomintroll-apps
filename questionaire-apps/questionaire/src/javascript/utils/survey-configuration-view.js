Ext.override(Ext.form.field.Base,{
    onDirtyChange: function(isDirty) {
        // make empty so that removing radio buttons before the class is updated doesn't throw an error
    }
});

Ext.define('CA.agile.technicalservices.survey.ConfigurationView',{
    extend: 'Ext.panel.Panel',
    alias: 'widget.surveyconfigurationview',
    logger: new Rally.technicalservices.Logger(),
    MAX_TITLE_LEN: 100,

    sectionTypeSuffix: '-type-',
    sectionTextSuffix: '-text-',
    sectionNextSectionSuffix: '-next-section-',
    deleteSectionSuffix: '-delete-section',
    sectionFieldSuffix: '-field-',
    sectionExampleValueSuffix: '-example-value',
    sectionUpdateContainerSuffix: '-update-container-' ,
    sectionFieldValueSuffix: '-field-value-',

    layout: 'accordion',
    flex: 1,
    width: 400,
    /**
     *  Configurations:
     *  surveyType: artifact type of the survey
     *  surveyPanels: array of panels
     **/

    initComponent: function(){
        this.items = this._getSections();

        this.callParent(arguments);
    },
    _getSections: function(){
        var sections = [],
            idx = 0;

        ////save the current section
        //Ext.Array.each(this.items, function(item){
        //    console.log('item', item);
        //    if (item.collapsed !== false){
        //        var sectionId = item.itemId;
        //        this.applySurveySettings(sectionId);
        //    }
        //}, this);

        Ext.Object.each(this.surveyPanelCfg.getPanels(), function(sectionID, section){
            sections.push(this._getSection(section, idx++));
        }, this);

        sections.push(this._getAddNewSection());

        return sections;
    },
    _getSectionKeys: function(){
        return Ext.Object.getKeys(this.surveyPanelCfg.getPanels());
    },
    _getAddNewSection: function(){
        var me = this;
        
        return {
            title: '<div class="add-new-section">Add a New Section...</div>',
            layout: 'hbox',
            items: [{
                xtype: 'rallytextfield',
                fieldLabel: 'Section Id',
                labelAlign: 'top',
                labelCls: 'rally-upper-bold',
                itemId: 'new-section-id',
                emptyText: 'Please enter a unique section id (25 characters or less)...',
                maxLength: 25,
                width: 300,
                margin: 10,
                height: 35,
                validator: function(value) { return me._validateSectionId(value,me); },
                listeners: {
                    scope: this,
                    change: this._enableSectionButton
                }
            },{
                xtype:'rallybutton',
                itemId: 'addSectionButton',
                text: 'Add Section',
                margin: '25 10 10 10',
                disabled: true,
                handler: this.addSection,
                scope: this
            }],
            collapsed: true
        };
    },
    _getSection: function(sectionConfig, idx){
        var title = Ext.String.ellipsis(Ext.String.format('Section [{0}] <div class="title-question">{1}</div>',sectionConfig.id , sectionConfig.text), this.MAX_TITLE_LEN),
            type = sectionConfig.type;
        
        return {
            title: title,
            flex: 1,
            items: this._getSectionItems(sectionConfig, idx),
            titleCollapse: false,
            itemId: sectionConfig.id,
            collapsed: sectionConfig.id !== 'root',
            listeners: {
                beforecollapse: function(p){
                  //  console.log('collapse', p.itemId,this.surveyPanelCfg.getPanel(p.itemId).options,this.getSectionOptions(p.itemId));
                    this.applySurveySettings(p.itemId);
                },
                scope: this
            }
        };
    },
    _getSectionItems: function(sectionConfig, idx){

        var type = sectionConfig.type;

        var sectionItems = [{
            xtype: 'textareafield',
            value: sectionConfig.text,
            itemId: this.getSectionTextItemId(sectionConfig.id),
            fieldLabel: 'Question',
            labelAlign: 'top',
            labelCls: 'rally-upper-bold',
            labelSeparator: '',
            grow: true,
            emptyText: 'Please type a question...',
            width: '90%',
            margin: 10,
            listeners: {
                blur: function(txt){
                    sectionConfig.text = txt.getValue();
                }
            }
        },{
            xtype: 'radiogroup',
            itemId: this.getSectionTypeItemId(sectionConfig.id),
            fieldLabel: 'Question Type',
            labelAlign: 'top',
            labelCls: 'rally-upper-bold',
            labelSeparator: '',
            columns: 4,
            width: '90%',
            margin: 10,

            items: [
                { boxLabel: 'Multiple Choice', name: sectionConfig.id + '-questionType', inputValue: 'choice', checked: type == 'choice' },
                { boxLabel: 'Text Entry Field', name: sectionConfig.id + '-questionType', inputValue: 'text', checked: type == 'text'}
            ],
            listeners: {
                scope: this,
                change: this.changeType
            }
        }];

        if (type == 'text'){
            sectionItems = sectionItems.concat(this._getTextTypeItems(sectionConfig));
        }

        if (type == 'choice'){
            sectionItems = sectionItems.concat(this._getChoiceTypeItems(sectionConfig));
        }

        if (sectionConfig.id !== 'root'){
            sectionItems.push({
                xtype: 'container',
                layout: 'hbox',
                items: [{
                    xtype: 'container',
                    flex: 1
                },{
                    xtype: 'rallybutton',
                    text: 'Delete Section',
                    iconCls: 'icon-warning',
                    cls: 'danger-button',
                    itemId: sectionConfig.id + this.deleteSectionSuffix,
                    handler: this.deleteSection,
                    scope: this
                }]
            });
        }

        return sectionItems;
    },
    _getTextTypeItems: function(sectionConfig){

        var model = this.surveyPanelCfg.model,
            field = sectionConfig.field;

        var nextSection = null,
            sectionKeys = this._getSectionKeys();
        if (sectionConfig.nextSection && Ext.Array.contains(sectionKeys, sectionConfig.nextSection)){
            nextSection = sectionConfig.nextSection;
        }

        return [{
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'Text Entry Field Name',
            labelAlign: 'top',
            labelCls: 'rally-upper-bold',
            itemId: this.getSectionFieldItemId(sectionConfig.id),
            width: 300,
            margin: 10,
            model: model,
            value: field,
            allowNoEntry: true,
            _isNotHidden: this.shouldShowTextField

        },{
            xtype: 'textareafield',
            value: sectionConfig.exampleValue || '',
            fieldLabel: 'Example Value',
            labelAlign: 'top',
            labelCls: 'rally-upper-bold',
            emptyText: 'Type question text...',
            itemId: this.getSectionExampleValueItemId(sectionConfig.id),
            labelSeparator: '',
            grow: true,
            width: '90%',
            margin: 10
        },{
            xtype: 'panelpicker',
            itemId: this.getSectionNextSectionItemId(sectionConfig.id),
            fieldLabel: 'Next Section',
            labelCls: 'rally-upper-bold',
            labelAlign: 'top',
            value: nextSection,
            keys: sectionKeys,
            margin: 5,
            currentSection: sectionConfig.id
        }];
    },
    _getChoiceTypeItems: function(sectionConfig, sectionIndex){
        var choiceItems = [{
                xtype: 'container',
                layout:'column',
                width: '100%',
                padding: 5,
                items:[{
                    xtype: 'container',
                    columnWidth:.05,
                    html: '&nbsp;'
                },{
                    xtype:'container',
                    html: '<div class="rally-upper-bold">Choice Option Text</div>',
                    columnWidth:.5
                },{
                    xtype: 'container',
                    columnWidth:.225,
                    html: '<div class="rally-upper-bold" style="text-align:center;">Next Section</div>'
                },{
                    xtype: 'container',
                    columnWidth:.225,
                    html: '<div class="rally-upper-bold" style="text-align:center;">Update Action</div>'
                }]
            }];

        var idx = 0,
            sectionKeys = this._getSectionKeys();


        var model = this.surveyPanelCfg.model;


        Ext.Array.each(sectionConfig.options || [], function(option){

            var nextSection = null;
            if (option.nextSection && Ext.Array.contains(sectionKeys, option.nextSection)){
                nextSection = option.nextSection;
            }

            choiceItems.push({
                xtype: 'container',
                layout:'column',
                width: '100%',
                padding: 5,
                items:[{
                    xtype: 'rallybutton',
                    iconCls: 'icon-delete',
                    cls: 'button-no-border',
                    itemId: sectionConfig.id + '-delete-' + idx,
                    columnWidth:.05,
                    handler: this.deleteOption,
                    scope: this
                },{
                    xtype:'textareafield',
                    grow: true,
                    fieldLabel: '',
                    emptyText: 'Type choice text...',
                    itemId: this.getSectionTextItemId(sectionConfig.id, idx),
                    columnWidth:.5,
                    value: option.text
                },{
                    xtype: 'panelpicker',
                    itemId: this.getSectionNextSectionItemId(sectionConfig.id,idx),
                    fieldLabel: '',
                    margin: '0 10 5 10',
                    value: nextSection,
                    keys: sectionKeys,
                    currentSection: sectionConfig.id,
                    columnWidth:.2
                },{

                    xtype: 'container',
                    itemId: this.getSectionUpdateContainerItemId(sectionConfig.id, idx),
                    columnWidth:.25,
                    items: [{
                        xtype: 'rallyfieldcombobox',
                        fieldLabel: 'Field',
                        labelAlign: 'right',
                        labelWidth: 75,
                        itemId: this.getSectionFieldItemId(sectionConfig.id, idx++),
                        model: model,
                        value: option.field || null,
                        allowNoEntry: true,
                        noEntryText: '-- None --',
                        _isNotHidden: this.shouldShowUpdateField,
                        listeners: {
                            select: this.updateFieldValueOptions,
                            scope: this,
                            ready: this.updateFieldValueOptions
                        }
                    }]
                }]
            });

        }, this);

        choiceItems.push({
            xtype:'rallybutton',
            iconCls: 'icon-add',
            itemId: sectionConfig.id + '-addOption',
            text: 'Add Choice',
            cls: 'button-no-border',
            margin: 5,
            handler: this.addOption,
            scope: this
        });

        return  choiceItems;
    },
    addOption: function(btn){
        var optionInfo = btn.itemId.replace('-addOption', '');
        if (optionInfo){
            var section = this.surveyPanelCfg.getPanel(optionInfo);

            section.options.push({
                text: '',
                nextSection: null
            });

            this.refreshSection(optionInfo);
        }
    },
    deleteOption: function(btn){
        var optionInfo = btn.itemId.split('-delete-');
        if (optionInfo && optionInfo.length == 2){
            var section = this.surveyPanelCfg.getPanel(optionInfo[0]);
            section.options.splice(optionInfo[1],1);
            this.refreshSection(optionInfo[0]);
        }
    },
    refreshSection: function(sectionId){
        console.log('refreshSection', sectionId);
        var sectionCmp = this.down('#' + sectionId);
        if (sectionCmp){
            this.applySurveySettings(sectionId);

            sectionCmp.removeAll();
            sectionCmp.add(this._getSectionItems(this.surveyPanelCfg.getPanel(sectionId)));
            sectionCmp.doLayout();
        }
    },
    applySurveySettings: function(sectionId, section){
        console.log('applySurveySettings', sectionId);
        
        if (!section){
            section = this.surveyPanelCfg.getPanel(sectionId);
        }

        //section.type = this.getSectionType(sectionId);
        //section.text = this.getSectionText(sectionId);

        console.trace('section.type', section.type);
        if (section.type === 'choice'){
            section.options = this.getSectionOptions(sectionId);
        } else {
            section.field = this.getSectionField(sectionId);
            section.exampleValue = this.down(this.getSectionExampleValueItemId(sectionId, true)) &&
                this.down(this.getSectionExampleValueItemId(sectionId, true)).getValue();
            section.nextSection = this.down(this.getSectionNextSectionItemId(sectionId, -1, true)) &&
                this.down(this.getSectionNextSectionItemId(sectionId, -1, true)).getValue();
        }
    },
    refreshSurvey: function(){
        this.removeAll();
        this.add(this._getSections());
        this.doLayout();
    },
    deleteSection: function(btn){
        var sectionId = btn.itemId.replace(this.deleteSectionSuffix,'');
        if (sectionId){
            this.surveyPanelCfg.removePanel(sectionId);
        }
        this.refreshSurvey();
    },
    addSection: function(){
        var sectionId = this.down('#new-section-id') && this.down('#new-section-id').getValue();
        if (!sectionId){
            Rally.ui.notify.Notifier.showError({message: 'Section ID cannot be blank.'});
            return;
        }

        if (Ext.Array.contains(this._getSectionKeys(), sectionId)){
            Rally.ui.notify.Notifier.showError({message: 'Section ID must be unique.  Please enter a unique section ID.'});
            return;
        }

        this.surveyPanelCfg.setPanel(sectionId, {
            type: 'choice',
            text: '',
            id: sectionId,
            itemId: sectionId,
            options: []
        });
        this.refreshSurvey();
    },
    
    _validateSectionId: function(value,me) {
        if ( /\s/.test(value) ) {
            return "Section ID cannot contain spaces.";
        }
        
        if ( /\W/.test(value) ) {
            return "Section ID must contain only letters, numbers and/or underscores";
        }
        
        if (Ext.Array.contains(me._getSectionKeys(), value)){
            return 'Section ID must be unique.';
        }
        
        if ( Ext.isEmpty(value) ) {
            return "Section ID cannot be blank.";
        }
        return true;
    },
    
    _enableSectionButton: function(field) {
        var button = this.down('#addSectionButton');
        
        if ( Ext.isEmpty(button) ) { return ; }
        
        if ( field.isValid() ) {
            button.setDisabled(false);
            return;
        }
        button.setDisabled(true);
    },
    
    changeType: function(group, newValue){
        var sectionId = group.itemId.replace(this.sectionTypeSuffix,'');
        
        group.suspendEvents();
        
        var name = sectionId + '-questionType';
        if (newValue && newValue[name]){
            this.surveyPanelCfg.getPanel(sectionId).type = newValue[name];
            console.log('changeType',sectionId, newValue[name]);
            this.refreshSection(sectionId);
        }
    },
    
    _getEditorFromFieldDef: function(fieldDef){
        
        if ( fieldDef.editor  && fieldDef.editor.xtype != "rallyrecordcontexteditor" ) { return fieldDef.editor; }
        
        var editor = { xtype:'rallytextfield' };
        
        if ( fieldDef.attributeDefinition.Constrained && fieldDef.custom ) {
            editor = {
                xtype: 'rallyfieldvaluecombobox',
                model: 'PortfolioItem',
                field: fieldDef.name
            };
        }
        
        return editor;
    },
    
    updateFieldValueOptions: function(cb){
        var info = cb.itemId.split(this.sectionFieldSuffix);
        var sectionId = info[0],
            idx = info[1],
            valueItemId = this.getSectionFieldValueItemId(sectionId, idx),
            containerId = this.getSectionUpdateContainerItemId(sectionId, idx);

        var value = this.surveyPanelCfg.getPanel(sectionId).options &&
            this.surveyPanelCfg.getPanel(sectionId).options[idx] &&
            this.surveyPanelCfg.getPanel(sectionId).options[idx].value || null

        var fieldDef = cb && cb.getRecord() && cb.getRecord().get('fieldDefinition');
        console.log('updateFieldValueOptions', fieldDef, value, containerId);
        var cfg = null;
        if (fieldDef && fieldDef.attributeDefinition){
            cfg = this._getEditorFromFieldDef(fieldDef);
            cfg.itemId = valueItemId;
            cfg.fieldLabel = 'Set to Value';
            cfg.labelAlign = 'right';
            cfg.labelWidth = 75;
            cfg.width = cb.getWidth();
            cfg.value = value;
        }

        var ct = this.down('#' + containerId);
        if (ct.down('#' + valueItemId)){
            ct.down('#' + valueItemId).destroy();
        }
        if (cfg){
            ct.add(cfg);
        }
    },
    shouldShowUpdateField: function(field){
        if (field.readOnly){ return false; }

        if (field && field.attributeDefinition){
            if (field.attributeDefinition.AttributeType === 'STRING' || field.attributeDefinition.AttributeType === 'TEXT'){
                return true;
            }
        }
        return false;
    },
    shouldShowTextField: function(field){

        if (field.readOnly){ return false; }

        if (field && field.attributeDefinition){
            if (field.attributeDefinition.AttributeType === 'STRING' || field.attributeDefinition.AttributeType === 'TEXT'){
                if (field.attributeDefinition.Constrained || field.constrained || field.editor.xtype === 'rallycombobox'){
                    return false;
                }
                return true;
            }
        }
        return false;
    },
    getSurveyConfig: function(){
        var surveyConfig = this.surveyPanelCfg;

        Ext.Object.each(this.surveyPanelCfg.getPanels(), function(sectionId, section){
            section.text = this.getSectionText(sectionId);
            section.type = this.getSectionType(sectionId);
            console.log('section', section.id, section.type);
            if (section.type === 'choice'){
                section.options = this.getSectionOptions(sectionId);
            } else {
                section.options = [];
                section.field = this.getSectionField(sectionId);
                section.exampleValue = this.down(this.getSectionExampleValueItemId(sectionId, true)) &&
                    this.down(this.getSectionExampleValueItemId(sectionId, true)).getValue();
                section.nextSection = this.down(this.getSectionNextSectionItemId(sectionId, -1, true)) &&
                    this.down(this.getSectionNextSectionItemId(sectionId, -1, true)).getValue();
            }
        }, this);

        return surveyConfig;
    },
    getSectionText: function(sectionId, idx){
        return this.down(this.getSectionTextItemId(sectionId, idx, true)) &&
                this.down(this.getSectionTextItemId(sectionId, idx, true)).getValue() || null;
    },
    getSectionTextItemId: function(sectionId, idx, includeHash){
        return this.getItemId(sectionId,this.sectionTextSuffix,idx,includeHash);
    },
    getSectionType: function(sectionId){
        return this.down(this.getSectionTypeItemId(sectionId, true)).getValue() &&
            this.down(this.getSectionTypeItemId(sectionId, true)).getValue()[sectionId + '-questionType'];
    },
    getSectionField: function(sectionId, idx){

        return this.down(this.getSectionFieldItemId(sectionId, idx, true)) &&
            this.down(this.getSectionFieldItemId(sectionId, idx, true)).getValue() || null;
    },
    getSectionFieldValue: function(sectionId, idx){
        return this.down(this.getSectionFieldValueItemId(sectionId, idx, true)) &&
            this.down(this.getSectionFieldValueItemId(sectionId, idx, true)).getValue() || null;
    },
    getSectionTypeItemId: function(sectionId, includeHash){
        return this.getItemId(sectionId,this.sectionTypeSuffix,-1,includeHash);
    },
    getSectionFieldItemId: function(sectionId, idx, includeHash){
        return this.getItemId(sectionId,this.sectionFieldSuffix,idx,includeHash);
    },
    getSectionFieldValueItemId: function(sectionId, idx, includeHash){
        return this.getItemId(sectionId,this.sectionFieldValueSuffix,idx,includeHash);
    },
    getSectionExampleValueItemId: function(sectionId,includeHash){
        return this.getItemId(sectionId, this.sectionExampleValueSuffix,-1,includeHash);
    },
    getSectionNextSectionItemId: function(sectionId, idx, includeHash){
        return this.getItemId(sectionId,this.sectionNextSectionSuffix,idx,includeHash);
    },
    getSectionUpdateContainerItemId: function(sectionId, idx, includeHash){
        return this.getItemId(sectionId, this.sectionUpdateContainerSuffix, idx, includeHash);
    },
    getItemId: function(sectionId, suffix, idx, includeHash){
        var itemId = sectionId + suffix;
        if (idx >= 0){
            itemId += idx;
        }

        if (includeHash){
            itemId = '#' + itemId;
        }
        return itemId;
    },
    getSectionOptions: function(sectionId){
        var options = this.surveyPanelCfg.getPanel(sectionId).options || [];

        for (var i=0; i< options.length; i++){
            options[i].text = this.getSectionText(sectionId, i);
            options[i].nextSection = this.down(this.getSectionNextSectionItemId(sectionId, i, true)) &&
                this.down(this.getSectionNextSectionItemId(sectionId, i, true)).getValue() || null;
            options[i].field = this.getSectionField(sectionId, i);
            options[i].value = this.getSectionFieldValue(sectionId, i);
        }
        return options;
    }

});