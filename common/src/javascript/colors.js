Ext.define('CA.agile.technicalservices.Colors', {
    singleton: true,
    
    // base colors: 
    pumpkin: '#FF671B', // darker orange
    tangerine: '#F38B00', // lighter orange
    turbo: '#FFC81F',  // off-yellow
    limerick: '#8DB92E', // green

    getBasicColors: function() {
        return [this.pumpkin,this.tangerine,this.turbo,this.limerick];
    },

    /*
     * repeat:  The number of times to repeat the basic array
     *          0 will return the basic array, 1 will return 
     *          the basic array and one repetition of the array
     */
    getRepeatedBasicColors: function(repeat) {
        var color_array = [];
        if ( Ext.isEmpty(repeat) ) { repeat = 0; }

        for ( var i=0; i<repeat; i++ ) {
            color_array = Ext.Array.push(color_array,this.getBasicColors());
        }
        return color_array;
    }

});
