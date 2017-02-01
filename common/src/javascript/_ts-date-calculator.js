Ext.define('TSDateCalculator',{
    singleton: true,
    
    // all of the first day counts as 1 day.  So December 1 at 5am is 1 day, so is 6pm.
    getDaysAfterMonthEnd: function(check_date) {
        var month = check_date.getMonth();
        var year = check_date.getFullYear();
        var month_end = new Date(year,month,1);
        
        return Rally.util.DateTime.getDifference(check_date,month_end,'day') + 1;
    },
    
    // all of the last day counts as 1 day.  So December 31 at 5am is 1 day, so is 6pm.
    getDaysBeforeMonthEnd: function(check_date) {
        var month = check_date.getMonth();
        var year = check_date.getFullYear();
        var month_end = Rally.util.DateTime.add(new Date(year,month,1),'month',1);
        
        return Rally.util.DateTime.getDifference(month_end,check_date,'day') + 1;
    },
    
    // given a date, and boundary limits for either side of a month end date, what's the
    // month this date is in (if any)?
    getMonthNameInLimits: function(check_date, before_limit, after_limit) {
        var before_days = this.getDaysBeforeMonthEnd(check_date);
        var after_days = this.getDaysAfterMonthEnd(check_date);
        
        if ( before_limit + after_limit >= 30 ) {
            return null;
        }
        
        if ( before_days <= before_limit ) {
            return Ext.Date.format(check_date,'F');
        }
        
        if ( after_days <= after_limit ) {
            var last_month = Rally.util.DateTime.add(check_date,'month',-1);
            return Ext.Date.format(last_month,'F');
        }
        
        return null;
    },
    
    getMonthIsoInLimits: function(check_date, before_limit, after_limit) {
        var before_days = this.getDaysBeforeMonthEnd(check_date);
        var after_days = this.getDaysAfterMonthEnd(check_date);
        
        if ( before_limit + after_limit >= 30 ) {
            return null;
        }
        
        if ( before_days <= before_limit ) {
            return Ext.Date.format(check_date,'Y-m-01');
        }
        
        if ( after_days <= after_limit ) {
            var last_month = Rally.util.DateTime.add(check_date,'month',-1);
            return Ext.Date.format(last_month,'Y-m-01');
        }
        
        return null;
    }

});