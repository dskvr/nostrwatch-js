'use strict';
import https from 'https-browserify'
import validator from 'validator'

export const isJson = function(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const getDaysBetween = (validFrom, validTo) => {
    return Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);
};

const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

export const getSSLCertificateInfo = (host, timeout) => {
    
    console.log('ssl', host)

    if(!validator.isFQDN(host)) {
        return Promise.reject(new Error('Invalid host.'));
    }
    const options = {
        agent: false,
        method: 'HEAD',
        port: 443,
        rejectUnauthorized: false,
        hostname: host
    };

    return new Promise((resolve, reject) => {
        
        try {
            const req = https.request(options, res => {
                console.log(res)
                const crt = res.socket.getPeerCertificate(),
                    vFrom = crt.valid_from, vTo = crt.valid_to;
                var validTo = new Date(vTo);
                resolve({
                    daysRemaining: getDaysRemaining(new Date(), validTo),
                    valid: res.socket.authorized || false,
                    validFrom: new Date(vFrom).toISOString(),
                    validTo: validTo.toISOString()
                });
            });
            req.on('error', reject);
            req.end();
        } catch (e) {
            reject(e);
        }
        if(timeout)
            setTimeout(()=>{ reject() }, 5000)
    });
};