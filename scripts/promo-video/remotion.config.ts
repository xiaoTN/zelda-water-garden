import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(2);
Config.setOffthreadVideoCacheSizeInBytes(32 * 1024 * 1024);
Config.setCrf(19);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
