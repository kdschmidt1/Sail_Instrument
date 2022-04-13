#! /bin/sh
#package build using https://github.com/goreleaser/nfpm on docker
pdir=`dirname $0`
pdir=`readlink -f "$pdir"`
#set -x
config=package.yaml
version="$1"
if [ "$version" = "" ] ; then
  version=`date '+%Y%m%d'`
fi
echo building version $version
tmpf=package$$.yaml
rm -f $tmpf
sed "s/^ *version:.*/version: \"$version\"/" $config > $tmpf
config=$tmpf
docker run  --rm   -v "$pdir":/tmp/pkg   --user `id -u`:`id -g` -w /tmp/pkg wellenvogel/nfpm:1.0 pkg -p deb -f $config
rt=$?
if [ "$tmpf" != "" ] ; then
  rm -f $tmpf
fi
exit $rt
