export const isJson = function(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export const fileExists = function(url) {
    try{
    var req = new XMLHttpRequest();
    req.open('HEAD', url, false);
    req.send();
    return req.status !== 404;
    } catch(e){""}
}