# Spark: *See the extraordinary in everyone instantly* 

Spark is an AI-powered tool built on the MentraOS glasses that lets people instantly discover the extraordinary individuals around them. 

By surfacing the factors and accomplishments that make a person remarkable, beyond just their job title or LinkedIn headline, Spark breaks the cold-start barrier in human connection. It provides baseline knowledge to help cultivate introductions, conversations, and relationships. Through this, Spark accelerates authentic connection and collaboration in real-world environments like conferences, hackathons, research labs, and entrepreneurial communities.

## Stack 

## Project Structure 

## Usage 


## Contribution  

## Inspiration and Impact 
In today’s hyperconnected world, we constantly walk past extraordinary people without ever realizing it–founders, scientists, activists, creators–simply because their stories can be invisible in real life. We were inspired by this invisible “context gap” and wanted to make meaningful connections effortless and serendipitous, especially in environments like hackathons or conferences, where collaboration potential is high but often missed.

But Spark doesn’t just surface context, it remembers people you’ve met, logs interactions, and builds an evolving map of your personal network. It helps you reconnect later and pick up past conversations. This transforms fleeting moments, which could have been foregone conversations, into lasting connections. 
 
## Credit 
Sohum Gautam, UPenn M&T '29
Sean Guno, UIUC CS + Chemistry & Bioengineering '26
Pari Latawa, MIT CS + Bio '26 
Mudit Marwaha, CS '26

## Acknowledgements


### Install MentraOS on your phone

MentraOS install links: [mentra.glass/install](https://mentra.glass/install)

### (Easiest way to get started) Set up ngrok

1. `brew install ngrok`

2. Make an ngrok account

3. [Use ngrok to make a static address/URL](https://dashboard.ngrok.com/)

### Register your App with MentraOS

1. Navigate to [console.mentra.glass](https://console.mentra.glass/)

2. Click "Sign In", and log in with the same account you're using for MentraOS

3. Click "Create App"

4. Set a unique package name like `com.yourName.yourAppName`

5. For "Public URL", enter your Ngrok's static URL

6. In the edit app screen, add the microphone permission

### Get your App running!

1. [Install bun](https://bun.sh/docs/installation)

2. Clone this repo locally: `git clone https://github.com/Mentra-Community/MentraOS-Camera-Example-App`

3. cd into your repo, then type `bun install`

5. Set up your environment variables:
   * Create a `.env` file in the root directory by copying the example: `cp .env.example .env`
   * Edit the `.env` file with your app details:
     ```
     PORT=3000
     PACKAGE_NAME=com.yourName.yourAppName
     MENTRAOS_API_KEY=your_api_key_from_console
     ```
   * Make sure the `PACKAGE_NAME` matches what you registered in the MentraOS Console
   * Get your `API_KEY` from the MentraOS Developer Console

6. Run your app with `bun run dev`

7. To expose your app to the internet (and thus MentraOS) with ngrok, run: `ngrok http --url=<YOUR_NGROK_URL_HERE> 3000`
    * `3000` is the port. It must match what is in the app config. For example, if you entered `port: 8080`, use `8080` for ngrok instead.


### Next Steps

Check out the full documentation at [docs.mentra.glass](https://docs.mentra.glass/camera)
