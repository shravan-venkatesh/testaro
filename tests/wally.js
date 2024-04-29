const https = require('https');
const DELAY=1200000;
const hostName = process.env.NODE_ENV === 'production' ? process.env.WALLY_PROD_URL : process.env.WALLY_DEV_URL;
exports.reporter = async (page, options) => {
    const {report, rules} = options;
    let data = {};
    let result = {};
    const postResult = await new Promise((resolve, reject) => {
        let resultData = "";
        const postData = JSON.stringify({
            email: "testaro@wallyax.com",
            url: page.url(),
        });

        const postOptions = {
            hostname: hostName,
            path: `/wallyax/start-audit/1.3?apikey=${process.env.WALLY_KEY ? process.env.WALLY_KEY : ''}`,
            method: "POST",
            protocol: "https:",
            headers: {
                'Content-Type': "application/json",
                "Content-Length": postData.length
            }
        }

        const postReq = https.request(postOptions, res => {
            res.on('data', (chunk) => {
                resultData += chunk;
            });
            res.on('end', async () => {
                try {
                    let getRes
                    console.log(resultData);
                    do {
                        getRes = await getReport(JSON.parse(resultData));
                        console.log(getRes);
                        await delay(DELAY/2);
                    } while (getRes.payload.status === 'in-progress' || getRes.payload.status === 'open' || getRes.payload.status === "pages_analysed");
                    resolve(getRes);
                } catch (err) {
                    data.prevented = true;
                    data.error = `ERROR executing Wally for page, ${err.message}`;
                    console.log("ERROR in get:", err);
                    return resolve({
                        resultData
                    })
                }
            });
        });

        // Handling errors for POST request
        postReq.on('error', (error) => {
            data.success = false;
            data.prevented = true;
            data.error = `ERROR executing Wally for page, ${error.message}`;
            console.error("Error in POST request:", error);
            resolve({
                resultData
            })
        });

        postReq.write(postData);
        postReq.end();
    });

    result = postResult;
    
    return {
        data, 
        result
    }
}

const getReport = async (data) => {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: hostName,
            path: `/wallyax/get-audit-detail/1.1/${data.payload.audit_id}?apikey=${process.env.WALLY_KEY ? process.env.WALLY_KEY : ''}`,
            protocol: "https:"
        }, response => {
            let actReport = '';
            response.on('data', chunk => {
                actReport += chunk;
            });
            response.on("end", () => {
                try {
                    const actResult = JSON.parse(actReport);
                    resolve(actResult);
                } catch (error) {
                    console.log("ERROR: ", error);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.error("Error in GET request:", error);
            reject(error);
        });
    });
}

const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve,ms))
}