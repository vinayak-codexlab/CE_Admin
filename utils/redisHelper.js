import { createClient } from "redis";

const redisClient = createClient({
    url : process.env.REDIS_URL
});

redisClient.on("error",(err)=> console.log("Redis Client Error !",err));
redisClient.on("connect", ()=> console.log("Redis connected successfully."));

//redis instance connection
(async ()=>{
    await redisClient.connect();
})();

//functions...
const setRedisCache = async (key, value, ttlInSeconds = 300)=>{
    try{
        const stringValue = JSON.stringify(value);
        await redisClient.setEx(key, ttlInSeconds, stringValue);
    } catch(err){
        console.log("Error in setting the redis!", err);
    }
}

const getRedisCache = async(key)=>{
    try{
        const cacheData = await redisClient.get(key);
        if (!cacheData) return null;
        return JSON.parse(cacheData);
    } catch(err){
        console.log("Error in getting the cache data !", err);
        return null;
    }
}
const removeRedisCache = async(key)=>{
    try{
        await redisClient.del(key);
    } catch(err){
        console.log("Error in the deleting cache data !", err);
        return null;
    }
};
const removeRedisCachePattern = async(pattern)=>{
    try{
        let cursor = "0";
        do{
            const reply = await redisClient.scan(cursor, {MATCH:pattern, COUNT:100});
            cursor = reply.cursor;
            const keys = reply.keys;
            if(keys.length>0){
                await redisClient.del(keys);
            }
        } while (cursor != "0");
    } catch(err){
        console.log("Error in deleting the pattern !",err);
    }
};

export { setRedisCache, getRedisCache, removeRedisCache, removeRedisCachePattern };