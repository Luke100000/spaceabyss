#!/bin/bash

CLIENT_DEV_DIRECTORY="/mnt/c/spaceabyss/public/dev_client"

# put in the production port, and production phaser
sed -i 's/8010/8000/g' /mnt/c/spaceabyss/public/dev_client/index.html
sed -i 's/phaser-3.15.1.js/phaser-3.15.1.min.js/g' /mnt/c/spaceabyss/public/dev_client/index.html

# now lets make a copy for itch.io
mkdir /mnt/c/spaceabyss/itch.io/${1}

cp /mnt/c/spaceabyss/public/dev_client/client_click_${1}.js /mnt/c/spaceabyss/itch.io/${1}/client_click_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/client_functions_${1}.js /mnt/c/spaceabyss/itch.io/${1}/client_functions_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/client_network_${1}.js /mnt/c/spaceabyss/itch.io/${1}/client_network_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/effects_${1}.js /mnt/c/spaceabyss/itch.io/${1}/effects_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/index.html /mnt/c/spaceabyss/itch.io/${1}/index.html
cp /mnt/c/spaceabyss/public/dev_client/monster_${1}.js /mnt/c/spaceabyss/itch.io/${1}/monster_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/planet_${1}.js /mnt/c/spaceabyss/itch.io/${1}/planet_${1}.js
cp /mnt/c/spaceabyss/public/dev_client/player_${1}.js /mnt/c/spaceabyss/itch.io/${1}/player_${1}.js


# put the development port and phaser back in
sed -i 's/8000/8010/g' /mnt/c/spaceabyss/public/dev_client/index.html
sed -i 's/phaser-3.15.1.min.js/phaser-3.15.1.js/g' /mnt/c/spaceabyss/public/dev_client/index.html


# rename our dev client to the next version
mv $CLIENT_DEV_DIRECTORY/client_click_${1}.js $CLIENT_DEV_DIRECTORY/client_click_${2}.js
mv $CLIENT_DEV_DIRECTORY/client_functions_${1}.js $CLIENT_DEV_DIRECTORY/client_functions_${2}.js
mv $CLIENT_DEV_DIRECTORY/client_network_${1}.js $CLIENT_DEV_DIRECTORY/client_network_${2}.js
mv $CLIENT_DEV_DIRECTORY/effects_${1}.js $CLIENT_DEV_DIRECTORY/effects_${2}.js
mv $CLIENT_DEV_DIRECTORY/monster_${1}.js $CLIENT_DEV_DIRECTORY/monster_${2}.js
mv $CLIENT_DEV_DIRECTORY/planet_${1}.js $CLIENT_DEV_DIRECTORY/planet_${2}.js
mv $CLIENT_DEV_DIRECTORY/player_${1}.js $CLIENT_DEV_DIRECTORY/player_${2}.js

# Update our index.html file to call the updated files
sed -i "s/client_functions_${1}/client_functions_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/client_network_${1}/client_network_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/client_click_${1}/client_click_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/effects_${1}/effects_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/monster_${1}/monster_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/planet_${1}/planet_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
sed -i "s/player_${1}/player_${2}/g" $CLIENT_DEV_DIRECTORY/index.html
