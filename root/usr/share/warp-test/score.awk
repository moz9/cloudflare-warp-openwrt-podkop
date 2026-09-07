# TSV: service|kind|latency_ms|curl_rc|http_code|bytes_per_second
{
    id=$1; total[id]++; last[id]=$2; code[id]=$5
    if ($2=="ok") good[id]++
    else if ($2=="restricted") restricted[id]++
    else if ($2=="dns") dns[id]++
    else if ($2=="network") network[id]++
    else http[id]++
    if ($2=="ok" || $2=="restricted" || $2=="http") times[id,++n[id]]=$3
}
END {
    for (id in total) {
        for(i=2;i<=n[id];i++){v=times[id,i];j=i-1;while(j>0 && times[id,j]>v){times[id,j+1]=times[id,j];j--}times[id,j+1]=v}
        p=int(n[id]*.95+.999); med=int((n[id]+1)/2)
        printf "%s|%d|%d|%d|%d|%d|%d|%d|%d|%s|%s\n",id,total[id],good[id],restricted[id],dns[id],network[id],http[id],times[id,med],times[id,p],last[id],code[id]
    }
}
