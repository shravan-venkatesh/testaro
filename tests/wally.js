const https = require('https');

exports.reporter = async (page, options) => {
    const {report, rules} = options;
    let data = {};
    let result = {};
    const postResult = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: "shravan2406@gmail.com",
            url: page.url(),
        });

        const postOptions = {
            hostname: "wally-stg1-api.wallyax.com",
            path: "/public/start-audit",
            method: "POST",
            protocol: "https:",
            headers: {
                'Content-Type': "application/json",
                "Content-Length": postData.length
            }
        }

        const postReq = https.request(postOptions, res => {
            let resultData = "";
            res.on('data', (chunk) => {
                resultData += chunk;
            });
            res.on('end', async () => {
                try {
                    let getRes
                    do {
                        await delay(30000);
                        getRes = await getReport(JSON.parse(resultData));
                    } while (getRes.payload.status !== 'completed' || getRes.payload.status !== "paused" || getRes.payload.status !== "failed");
                    resolve(getRes);
                } catch (err) {
                    data.prevented = true;
                    data.error = `ERROR executing Wally for page, ${error.message}`;
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
    console.log("Wally generated report ", postResult);
    
    return {
        data, 
        result
    }
}

const getReport = async (data) => {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: "wally-stg1-api.wallyax.com",
            path: `/audit/summary/public/${data.payload.audit_id}`,
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