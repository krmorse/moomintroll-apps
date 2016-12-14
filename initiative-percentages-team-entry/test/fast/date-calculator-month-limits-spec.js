describe("When using the date calculator for determing month limits", function() {
    
    it("should determine month a day before the end falls in given reasonable limits",function(){
        var jsdate = new Date(2016,10,27,18,0,0); // 6pm on november 27, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 5, 3)).toEqual('November');
    });
    
    it("should determine month a day after the end falls in given reasonable limits",function(){
        var jsdate = new Date(2016,11,2,18,0,0); // 6pm on december 2, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 5, 3)).toEqual('November');
    });
    
    it("should determine month the first day of the month falls in given reasonable limits",function(){
        var jsdate = new Date(2016,11,1,18,0,0); // 6pm on december 1, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 5, 3)).toEqual('November');
    });

    it("should determine month the last day of the month falls in given reasonable limits",function(){
        var jsdate = new Date(2016,10,30,18,0,0); // 6pm on november 30, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 5, 3)).toEqual('November');
    });
    
    it("should return null if day is outside allowed range",function(){
        var jsdate = new Date(2016,10,15,18,0,0); // 6pm on november 30, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 5, 3)).toBe(null);
    });
    
    it("should throw error if range is too high",function(){
        var jsdate = new Date(2016,10,30,18,0,0); // 6pm on november 30, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 16, 16)).toBe(null);
    });
    
    it("should throw error if range is too high",function(){
        var jsdate = new Date(2016,10,30,18,0,0); // 6pm on november 30, 2016
        
        expect(TSDateCalculator.getMonthNameInLimits(jsdate, 3, 28)).toBe(null);
    });
   
    it("should determine Iso month a day before the end falls in given reasonable limits",function(){
        var jsdate = new Date(2016,10,27,18,0,0); // 6pm on november 27, 2016
        
        expect(TSDateCalculator.getMonthIsoInLimits(jsdate, 5, 3)).toEqual('2016-11-01');
    });
});
