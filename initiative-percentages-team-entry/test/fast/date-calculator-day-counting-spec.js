describe("When using the date calculator for counting days", function() {
    
    it("should determine days after end of month the first day of the month",function(){
        var jsdate = new Date(2016,11,1,18,0,0); // 6pm on december 1, 2016
        expect(TSDateCalculator.getDaysAfterMonthEnd(jsdate)).toEqual(1);
    });
    
    it("should determine days after end of month for a morning",function(){
        var jsdate = new Date(2016,11,5,5,0,0); // 5 am on december 5, 2016
        expect(TSDateCalculator.getDaysAfterMonthEnd(jsdate)).toEqual(5);
    });
    
    it("should determine days after end of month for an evening",function(){
        var jsdate = new Date(2016,11,5,18,0,0); // 6pm on december 5, 2016
        expect(TSDateCalculator.getDaysAfterMonthEnd(jsdate)).toEqual(5);
    });
    
    it("should determine days before end of month the first day of the month",function(){
        var jsdate = new Date(2016,11,1,18,0,0); // 6pm on december 1, 2016
        expect(TSDateCalculator.getDaysBeforeMonthEnd(jsdate)).toEqual(31);
    });
    
    it("should determine days before end of month the last day of the month",function(){
        var jsdate = new Date(2016,11,31,18,0,0); // 6pm on december 31, 2016
        expect(TSDateCalculator.getDaysBeforeMonthEnd(jsdate)).toEqual(1);
    });
        
    it("should determine days before end of month for a morning",function(){
        var jsdate = new Date(2016,11,25,5,0,0); // 5 am on december 25, 2016
        expect(TSDateCalculator.getDaysBeforeMonthEnd(jsdate)).toEqual(7);
    });
    
    it("should determine days before end of month for an evening",function(){
        var jsdate = new Date(2016,11,25,18,0,0); // 6pm on december 5, 2016
        expect(TSDateCalculator.getDaysBeforeMonthEnd(jsdate)).toEqual(7);
    });
});
