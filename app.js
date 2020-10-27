//jshint esversion:6
require('dotenv').config();
//const md5 = require('md5'); Using bcrypt instead to hash and salt Passwords
const express = require('express');
const mongoose = require('mongoose');
//const encrypt = require('mongoose-encryption'); Using Md5 instead to hash Passwords
const bodyParser = require('body-parser');
const ejs = require('ejs');
const bcrypt = require('bcrypt');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');
const oauth20 = require('passport-google-oauth20');
// const findOrCreate = require('mongoose-findorcreate'); uninstalled
const facebookOAuth20 = require('passport-facebook');

const app = express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static('public'));
app.set('view engine','ejs');


const port = process.env.port;
const uri = process.env.uri;

//Example of express-session and passport setting up
const sess = {
  secret:process.env.sessSecret,
  resave:false,
  saveUninitialized:false
};
app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());


// Setting up Mongoose Users collection and secret collection
mongoose.connect(uri, {useNewUrlParser:true, useUnifiedTopology:true}, ()=>{
  console.log('Connected Successfuly to mongodb');
})
mongoose.set('useCreateIndex',true);

const secretSchema = new mongoose.Schema({
  user:{
    type:String,
    required:true
  },
  secret:String
});

const usersSchema = new mongoose.Schema({
  username:{
    type: String,
    required:true
  },
  password:{
    type: String
  },
  externalId:{
   type: String
 },
 secret:[secretSchema]
});

//Example of passport-local-mongoose
usersSchema.plugin(passportLocalMongoose);


// Examples of using bycrypt
// const saltRounds = 10;
// const testPass = 'qwerty';
//
// bcrypt.hash(testPass,saltRounds, (err,pHash)=>{
//   console.log(pHash);
// });

// Examples of using mongoose-encryption
// const secretString = process.env.encrypKey;
// usersSchema.plugin(encrypt,{secret:secretString, excludeFromEncryption: ['email']});

const Users = new mongoose.model('User',usersSchema);
const Secrets = new mongoose.model('secret',secretSchema);

//Example of passport-local-mongoose creating a login strategy and searialising and de-searialising users
passport.use(Users.createStrategy());
// passport.serializeUser(Users.serializeUser());
// passport.deserializeUser(Users.deserializeUser());

//Example of using passport to searialise users
passport.serializeUser((user,done)=>{
  console.log('serializeUser '+ user.id);
  done(null,user.id);
});

passport.deserializeUser((id,done)=>{
  Users.findOne({_id:id},(err,user)=>{
    console.log('User deserialized');
    done(err,user)
  });
});

//setting up OAuth2.0 google
const googleStrategy = oauth20.Strategy;

passport.use(new googleStrategy({
  clientID: process.env.OAuthClientID,
  clientSecret:process.env.OAuthClientSecret,
  callbackURL:'http://localhost:3000/auth/google/secrets'
  }, (accessToken,refreshToken,profile,cb)=>{
    // Users.findOrCreate({googleId:profile.id}, (err, user)=>{
    //   if(user){
    //     console.log('User was found');
    //   }else{
    //     console.log(err);
    //   }
    //   return cb(err,user);
    // });
  Users.findOne({externalId:profile.id},(err,user)=>{
      if(user){
        console.log('User was Found');
        cb(null, user)
      }else{
        console.log('No user found, adding new user to DB ');
        newUser = new Users({
          externalId:profile.id,
          username:profile.emails[0].value
        });
        newUser.save(()=>{
          console.log('This user is saved');
        });
        cb(null,newUser);
      }
  })
}));

//setting up OAuth2.0 facebook
const facebookStrategy = facebookOAuth20.Strategy;

passport.use(new facebookOAuth20({
  clientID: process.env.FacebookId,
  clientSecret: process.env.FacebookSecret,
  callbackURL: "http://localhost:3000/auth/facebook/callback",
  profileFields: ['id','emails','name']
},(accessToken, refreshToken, profile, cb)=>{
  console.log(profile.emails[0].value);
  Users.findOne({externalId:profile.id},(err,user)=>{
    if(!err){
      if(user){
        console.log('User was found');
        cb(err,user);
      }else{
        console.log('No user found, adding new user to DB');
        newUser = new Users({
          externalId:profile.id,
          username:profile.emails[0].value
        });
        newUser.save(()=>{
          console.log('This user is saved');
        });
        cb(err,newUser);
      }
    }else{
      console.log(err);
      res.redirect('/login')
    }
  })
}));

app.listen(port, (err)=>{
  if(!err){
      console.log('Listening on port');
  }else{
    console.log(err);
  }
});

app.get('/',(req,res)=>{
  res.render('home')
});

app.get('/secrets',(req,res)=>{
  var secrets = [];
  if(req.isAuthenticated()){
    console.log('did authenticte in secrets');
    Secrets.find({},(err, results)=>{
      secrets = results;
      res.render('secrets',{secrets:secrets});
    });
  }else{
    console.log('didn\'t authenticte in secrets');
    res.redirect('/login')
  }
});

app.route('/register')
.get((req,res)=>{
  res.render('register')
})
.post((req,res)=>{
  //using passport to register users
  let userName = req.body.username;
  let userPassword = req.body.password;

  Users.register({username:userName},userPassword,(err,user)=>{
    if(!err){
      console.log('user has been registered '+ user);
      passport.authenticate('local')(req,res,()=>{
        console.log('authed');
        res.redirect('/secrets')
      });
    }else{
      console.log(err);
      res.redirect('/register');
    }
  });

  //let userPassword = md5(req.body.password); example of Md5

  //Example of using bcrypt
  // let saltRounds = 10;
  // let userEmail = req.body.username;
  // let userPassword = bcrypt.hashSync(req.body.password,saltRounds);
  // console.log(userPassword);
  //
  // const newUser = new Users({
  //   email: userEmail,
  //   password:userPassword
  // });
  // newUser.save((err)=>{
  //   if(err){
  //     console.log(err);
  //   }else{
  //     console.log("save user "+ userEmail);
  //     res.render('secrets');
  //   }
  // })
});


app.route('/login')
.get((req,res)=>{
  res.render('login')
})
.post((req,res)=>{
  console.log('Login request has been made');
  //using passport to login users
  let userName = req.body.username;
  let userPassword = req.body.password;

  const user = new Users({
    username:userName,
    password:userPassword
  });

  req.login(user,(err)=>{
    if(!err){
      console.log('NO error');
      passport.authenticate('local')(req,res,()=>{
        console.log('Login was authenticated');
        res.redirect('/secrets')
      });
    }else{
      console.log(err);
      res.redirect('/login');
    }
  });
  //let userPassword = md5(req.body.password); example of Md5
  //Example of using bcrypt
  // let saltRounds = 10;
  // let userEmail = req.body.username;
  // let userPassword = req.body.password;
  //
  // Users.findOne({email:userEmail},(err, result)=>{
  //   if(!err){
  //     if(result){
  //       let check = bcrypt.compareSync(userPassword, result.password);
  //       if(check){
  //         res.render('secrets');
  //       }else{
  //         res.send('Feq aff')
  //       }
  //     }else{
  //       console.log(result);
  //       res.send('no user found')
  //     }
  //   }else{
  //     console.log(err);
  //   }
  // });
});

//google routes
app.route('/auth/google') . get(
  passport.authenticate('google',{scope:['profile','email']})
);

app.route('/auth/google/secrets') .get(
  passport.authenticate('google',{failureRedirect:'/register'}),(req,res)=>{
    console.log('authenticate in /auth/google/secrets');
    res.redirect('/secrets');
  }
);

//facbook routes
app.get('/auth/facebook', passport.authenticate('facebook',{ scope : ['email'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook',{failureRedirect:'/login'}),(req,res)=>{res.redirect('/secrets')});

//submit page
app.route('/submit') .get((req,res)=>{
  if(req.isAuthenticated()){
    console.log('Was authenticted in submit route');
    res.render('submit')
  }else{
    console.log('Was not authenticted in submit route');
    res.redirect('/');
  }
}) .post((req,res)=>{
  let userSecret = req.body.secret;
  let userId = req.user._id;

  secret = new Secrets({
    user:userId,
    secret:userSecret
  });

  secret.save((err)=>{
    if(!err){
      console.log('new secrets saved');
    }else{
      res.redirect('/secrets');
    }

  });

  Users.findOne({_id:userId},(err,user)=>{
    if(!err){
      if(user){
        var i = 0;
        for(i;i<user.secret.length;i++){
          console.log(user.secret[i]);
        }
        user.secret[i] = secret;
        user.save(()=>{
          console.log('saved secret to user: '+userId);
          res.redirect('/secrets');
        });
      }
    }else{
      console.log(err);
      res.redirect('/secrets')
    }
  })
});

app.get('/logout',(req,res)=>{
  req.logout();
  console.log('User Logged out');
  res.redirect('/')
});
