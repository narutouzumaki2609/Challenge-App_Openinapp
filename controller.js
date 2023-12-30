import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { ApplicationError } from './applicationError.js';
import dotenv from 'dotenv';
import cron from 'node-cron'
dotenv.config();


const googleservice = async () => {
    try {
        const oAuth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI,
        );
        oAuth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN,
            token_type: 'Bearer',
            scope: 'https://mail.google.com/',
        });
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        const accessToken = await oAuth2Client.getAccessToken();
        return [gmail, accessToken];
    }
    catch (error) {
        console.error('Error in googleservice:', error);
        throw error; // rethrow the error to propagate it
    }
}


async function checkForNewEmails() {
    const gmail = await googleservice();
    const response = await gmail[0].users.messages.list({
        userId: 'me',
        q: 'is:inbox', // You can customize the search query as needed
        maxResults: 1, // Limit to 1 messages for optimization
        fields: 'messages/id, messages/threadId', // Request only necessary fields
    });

    const messages = response.data.messages || [];
    console.log(messages)
    return messages;
};

async function hasNoPriorReplies(messageId) {
    const gmail = await googleservice();
    const response = await gmail[0].users.messages.get({
        userId: 'me',
        id: messageId,
    });

    const email = response.data;
    const threadId = email.threadId;

    const threadResponse = await gmail[0].users.threads.get({
        userId: 'me',
        id: threadId,
    });

    const thread = threadResponse.data;
    const messages = thread.messages || [];

    // Check if the thread has only one message (no prior replies)
    return messages.length === 1;
}

// Function to send a reply and add a label
async function sendReplyAndAddLabel(messageId) {
    const gmail = await googleservice();
    // checking of the message has any prior reply or not
    const noPriorReplies = await hasNoPriorReplies(messageId); // true/false

    if (noPriorReplies) {
        // Retrieve the email content using the messageId
        const response = await gmail[0].users.messages.get({
            userId: 'me',
            id: messageId,
        });
        let senderEmail = []
        let Subjects = []
        const messages = response.data;
        console.log(messages)

        const headers = messages.payload.headers;
        // Find the sender's email address
        const sender = headers.find(header => header.name.toLowerCase() === 'from');
        const sendemail = sender ? sender.value : 'Unknown Sender';
        senderEmail.push(sendemail)

        // Extracting subject from email
        const subject = headers.find(header => header.name.toLowerCase() === 'subject').value;
        Subjects.push(subject)
        console.log('Sender Email:', sendemail);
        console.log('Subject:', subject);


        // Compose the reply message
        const replyMessage = `Thank you for your email, ${senderEmail[0]}. I appreciate your message regarding "${Subjects[0]}".`;
        try {
            console.log('Access Token:', gmail[1]);
            const transport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: 'bhartikaundal0920@gmail.com',
                    clientId: process.env.CLIENT_ID,
                    clientSecret: process.env.CLIENT_SECRET,
                    refreshToken: process.env.REFRESH_TOKEN,
                    accessToken: gmail[1],
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            const mailOptions = {
                from: 'bhartikaundal0920@gmail.com',
                to: senderEmail[0],
                subject: `Re: ${Subjects[0]}`,
                text: replyMessage
            };
            const result = await transport.sendMail(mailOptions);
            console.log("result for sending mail", result)

            await addLabel(messageId);
            // console.log(`Added label to message ${messageId}`);
        } catch (err) {
            console.log(err);
            throw new ApplicationError('Something went wrong with database', 500);
        }

        console.log(`Replied to message ${messageId}`);


    }
}

async function addLabel(messageId) {
    const labelName = 'SPAM'; // Replace with your desired label name
    const gmail = await googleservice();
    const labelsResponse = await gmail[0].users.labels.list({
        userId: 'me',
    });

    const labels = labelsResponse.data.labels || [];
    const labelExists = labels.some(label => label.name === labelName);
    console.log(labelExists)
    if (!labelExists) {
        // If the label doesn't exist, create it
        await gmail[0].users.labels.create({
            userId: 'me',
            resource: {
                name: labelName,
            },
        });
    }

    // Add the label to the email
    await gmail[0].users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
            addLabelIds: [labelName],
        },
    });
    console.log(`Added label to message ${messageId}`);
}



const run = async () => {
    try {
        const newEmails = await checkForNewEmails();

        for (const email of newEmails) {
            // Check if the email has no prior replies
            await sendReplyAndAddLabel(email.id);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}
// Schedule the tasks at random intervals
cron.schedule('* * * * *', async () => {
    try {
        const newEmails = await checkForNewEmails();

        for (const email of newEmails) {
            // Check if the email has no prior replies
            await sendReplyAndAddLabel(email.id);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
});


export default { checkForNewEmails, run }