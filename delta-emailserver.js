#!/usr/local/bin/node
var email = require("emailjs"),
    simplesmtp = require("simplesmtp"),
    MailParser = require("mailparser").MailParser,
    mailparser = new MailParser(),
    fs = require('fs'),
    array=lines=dArray=[],
    ddmmyyPattern = new RegExp(/[0123][0-9][A-Z]{3}[12][0-9]-[0123][0-9][A-Z]{3}[12][0-9]/), // find this 01JAN15-30JAN15
    ddmmPattern = new RegExp(/[0123][0-9][SMTWF]/);

var months = { JAN:00, FEB:01, MAR:02, APR:03, MAY:04, JUN:05, JUL:06, AUG:07, SEP:08, OCT:09, NOV:10, DEC:11 };
var day,month,year,countTripDays=aCount=0,fileContents;
var icsData='', emailBody='', urlSchedule='', emailedSchedule='';
var iCal = [];
var props = [];
var VEvent = {}; 
var emailFrom, emailTo, emailSubject;
var port=25;
var nonSchedule=false;

simplesmtp.createSimpleServer({}, function(req){
   emailFrom = req.from;
   emailTo =   req.to;
   req.accept();
   console.log("req.from ", req.from);
   console.log("req.to ", req.to);

   req.on('data', function(chunk){
     mailparser.write(chunk);
     console.log("chunk");
   });

   req.on('end', function( ){
     mailparser.end();
   });

}).listen( 25,  function(){ 
  console.log('server stmp started');
});


mailparser.on("end", function(mail_object){
//     console.log("mail_object" , mail_object);
     parseEmail( mail_object.text );
 
});



function sendEmail( data, callback ){
   emailBody='';

   attachmentNotice = '**attachment is the full schedule that can be downloaded and imported into any calendar \n\n';
   emailContentType = '<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">';
   emailBody = "<html><head>\n" + emailContentType + "\n</head><body><pre>" + attachmentNotice +  urlSchedule + "</pre>\n<pre>" + emailedSchedule + "\n</pre></body></html>"



   var message = {
      text:    'bryankgraham@gmail.com',    
      from:    'bryankgraham@gmail.com',
      to:       emailFrom,
      subject: "delta schedule ",
      attachment: 
      [
         { data: emailBody, alternative:true},
         { data: data, type: 'text/plain', name: 'delta-schedule.ics' }
      ]
   }

   server.send(message,  function(err, message) { 
       console.log("GMAIL STATUS" , err || message); 
       callback();
   });
 

}


function formatDateTimeStamp(date) {
//  console.log("DATE " ,date);
  var formatted = date.toISOString()
    .replace(/-|:/g, '')
    .slice(0, 13)
    .concat('00Z');

  return formatted;
}

function addIcsCalendarHeader( ){
  props.push('BEGIN:VCALENDAR');
  props.push('VERSION:2.0');
}

function addIcsCalendarFooter( ){
  props.push('END:VCALENDAR');
  return props.join('\n');
}


function formatEmailText( event ){
  var printSchedule=href='';
  printSchedule = event.eventName + "\n" + event.dtstart + "\n" + event.dtend + "\n";
  href = 'http://www.google.com/calendar/event?action=TEMPLATE&text='+encodeURIComponent(event.eventName)+'&dates='+formatDateTimeStamp(event.dtstart)+'/'+formatDateTimeStamp(event.dtend)+'&details='+encodeURIComponent(event.desc)+'&location=delta&trp=false&sprop=&sprop=name:';
//console.log(href)

  urlSchedule +=  printSchedule + '<a href='+href+' target="_blank" rel="nofollow">Add to calendar</a>\n\n'
//console.log(urlSchedule);

//"http://www.google.com/calendar/event?action=TEMPLATE&text=3 Day Trip (1524-2115) Credit: 1617&dates=20141205T152400Z/20141207T211500Z&details=05F,OT,4393,1524,2115,1617,06S,X,07S,X&location=home&trp=false&sprop=&sprop=name:"
//Add to my calendar
}

function addIcsData( event ){
  formatEmailText(event);
  var now = new Date();

  props.push('BEGIN:VEVENT');
  props.push('DTSTAMP:' + formatDateTimeStamp(now)  );
  props.push('DTSTART:' + formatDateTimeStamp(event.dtstart) );
  props.push('DTEND:' + formatDateTimeStamp(event.dtend) );
  if (event.desc) {
    props.push('DESCRIPTION:' + event.desc);
  }
  props.push('SUMMARY:' + event.eventName);
  props.push('END:VEVENT');

}

function expandData( Event ){
//    console.log("expandData.Event: " , Event);
     var startTimeHour = Event.startTime.slice(0,2);
     var startTimeMins = Event.startTime.slice(2,4);

     var endTimeHour = Event.endTime.slice(0,2);
     var endTimeMins = Event.endTime.slice(2,4);
     VEvent.dtstart = new Date( Date.UTC( '20'+Event.year,months[Event.month],Event.day,startTimeHour,startTimeMins,0,0));
     VEvent.dtstart.setTime( VEvent.dtstart.getTime() + Event.dtstart.getTimezoneOffset()*60*1000 );
     //console.log("VEvent.dtstart " , VEvent.dtstart);
     VEvent.dtend = new Date( Date.UTC( '20'+Event.year,months[Event.month],Event.day,endTimeHour,endTimeMins,0,0));
     VEvent.dtend = new Date( VEvent.dtend.getTime() + (countTripDays - 1) * 24 * 60 * 60 * 1000 );
     VEvent.dtend.setTime( VEvent.dtend.getTime() + Event.dtend.getTimezoneOffset()*60*1000 );
     //console.log("VEvent.dtend " , VEvent.dtend);

     if ( startTimeHour != '00' ){
       VEvent.eventName = countTripDays + " " + Event.tag + " (" + VEvent.startTime + "-" + VEvent.endTime + ") Credit: " + VEvent.credits;
     }
     else {
       VEvent.eventName = countTripDays + " " + Event.tag;
     }

 
}

function checkForEventEnd( element, index, array ){
     if ( countTripDays > 0 && array[index-1][1] != element[1] ){ 
       addEventToSchedule(); 
     }
     else if ( array[index-1][1] == element[1] )
     { 
        ++countTripDays; 
     }
     else { 
       countTripDays = 1;
       VEvent.day = day;
     }
}

function addEventToSchedule( ){
     expandData( VEvent );
//     console.log("VEvent with dates " , VEvent);
     iCal.push( VEvent );
     VEvent={};
     VEvent.month = month;
     VEvent.year = year;
     VEvent.day = day;
     countTripDays = 1;
}

function parseEmail( data ){
      
      emailedSchedule = data;
      lines = data.split('\n')
      lines = lines.filter(function(item, pos, self) { //remove all duplicate lines
        return self.indexOf(item) == pos;
      })
      lines.forEach(function (element, index, array){

         array[index] = element.split(' ').filter(function(str) {
              return /\S/.test(str);
          });

          aData = array[index].filter(function(n){ return n != undefined }); 

          if ( aData.length > 0 ){
            dArray.push( aData ); 
          } 

      });


     dArray.forEach(function (daArray, index, array){
        ++aCount;
  
        if (daArray[0] === 'SKDS' && daArray.length < 10)  {
          console.log("Good Data: " , daArray);
          month=year='';
          daArray.forEach(function(dateStr) {
            if (dateStr.match(ddmmyyPattern) ){
                month = dateStr.slice(2,5)
                year = dateStr.slice(5,7)
            }
          });
        }
        else if ( daArray[0].match(ddmmPattern) ) {
          console.log("Good Data: " , daArray);
          day = daArray[0].slice(0,2);

           if(daArray[1]) {   

             switch (daArray[1]){
              case String(daArray[1].match(/\d+/)):
                 if ( countTripDays > 0 ) { addEventToSchedule(); }
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = daArray[2];
                 VEvent.endTime = daArray[3];
                 VEvent.credits = daArray[4];
                 VEvent.month = month;
                 VEvent.year = year;
                 countTripDays = 1;
                 VEvent.type = 'ROT';
                 VEvent.tag = "ADY Trip";
               break;
              case 'X':
                 VEvent.desc += "\n" + daArray;
                 ++countTripDays;
               break;
              case 'OT':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = daArray[3];
                 VEvent.endTime = daArray[4];
                 VEvent.credits = daArray[5];
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'OT';
                 VEvent.tag = "Day Trip"
               break;
              case 'SWP':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray;
                 VEvent.startTime = daArray[3];
                 VEvent.endTime = daArray[4];
                 VEvent.credits = daArray[5];
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'SWP';
                 VEvent.tag = "Day Trip";
               break;
              case 'ADY3':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = '0000';
                 VEvent.endTime = '2300';
                 VEvent.credits = '0000';
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'ADY3';
                 VEvent.tag = 'ADY';
               break;
              case 'VAC':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = '0000';
                 VEvent.endTime = '2300';
                 VEvent.credits = '0000';
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'VAC';
                 VEvent.tag = 'Vacation Days';
               break;
              case 'ADYX':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = '0000';
                 VEvent.endTime = '2300';
                 VEvent.credits = '0000';
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'ADYX';
                 VEvent.tag = 'ADX Canceled'
               break;
              case 'ADV':
                 checkForEventEnd( daArray, index, array );
                 VEvent.desc = daArray.toString();
                 VEvent.startTime = daArray[3];
                 VEvent.endTime = daArray[4];
                 VEvent.credits = daArray[5];
                 VEvent.month = month;
                 VEvent.year = year;
                 VEvent.type = 'ADV';
                 VEvent.tag = "ADY";
               break;
              default:
             }//end of Switch
             
   
           }//end if check for existents of second element in array (daArray[1])
        }//end if check for date pattern in first element in array (20T, 21W) 
        else {
            console.log("bad line in file: ", daArray);

        } //else default for everything not matchng SDKS or Date Pattern

        
        if ( array.length == aCount && emailTo[0] === 'steve@beaconidentity.com'){ 
            console.log("array length equals count");
            addEventToSchedule(); 
            addIcsCalendarHeader();
            iCal.forEach(function( element, index, array ){
               addIcsData(element);
               console.log(index + ": " + element)
            });
            icsData = addIcsCalendarFooter();
     //       console.log(icsData) ;
        
            sendEmail( icsData, function(){
              icsData=emailBody=urlSchedule=emailedSchedule=printSchedule='';
        
              console.log("emailed Send");
        
            });
        }


     });

     icsData=emailBody=urlSchedule=emailedSchedule=printSchedule='';
     countTripDays=0;
     dArray=[];
     aCount=0;
     iCal=[];
     props=[];

    

//     iCal.forEach(function( element, index, array ){
//        console.log( index + " Event " + JSON.stringify(element) ); 
//     });

  
}
