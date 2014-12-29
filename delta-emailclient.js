var email = require("emailjs"),
    fs = require('fs');

var server = email.server.connect({
//   host:    "74.125.29.26",
//   host:    "localhost",
   host:    "54.243.63.139"
});

fs.readFile('./email.txt','utf8', function (err, fileContents) {
   server.send({
      text:    fileContents,    
      from:    "bryankgraham@gmail.com", 
      to:      "steve@beaconidentity.com",
      subject: "delta schedule",
   }, function(err, message) { 
       //console.log(err || message); 
   });
});
