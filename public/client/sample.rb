require 'net/http'
require 'uri'
require 'rest_client'
require 'pusher-client'
require 'json'
require 'optparse'
require 'logger'

Version = "1.2.0"
SYS_ETH0_MACADDR = "/sys/class/net/eth0/address"

class TemperatureSensors
  class Dummy
    def value
      return (20.0 + rand*10).round(2)
    end
  end

  class LM75
    def initialize(bus=3, addr=48)
      @sysfs = sprintf("/sys/class/i2c-dev/i2c-%d/device/%d-%04d/temp1_input",
                       bus, bus, addr)
      return if FileTest.readable? @sysfs
      raise DeviceNotFound, "Unable to read #{@sysfs}"
    end

    def value
      File.open(@sysfs, "r") do |f|
        (f.read.to_f/1000).round(2)
      end
    end
  end

  class BMIC
    def initialize
      @sysfs = "/sys/class/thermal/thermal_zone0/temp"
      return if FileTest.readable? @sysfs
      raise DeviceNotFound, "Unable to read #{@sysfs}"
    end

    def value
      File.open(@sysfs, "r") do |f|
        (f.read.to_f/1000).round(2)
      end
    end
  end

  class DeviceNotFound < RuntimeError; end

  def initialize
    [LM75, BMIC, Dummy].each do |c|
      begin
        o = c.new
      rescue DeviceNotFound => e
        #p e # uncomment this to debug
        next
      end
      @adopter = o
      return
    end
  end

  def value
    @adopter.value
  end
end

module GPS
  class Base
    def update
      raise NotImplementedError, "You must implement #{self.class}##{__method__}"
    end

    def location
      return {:latitude => @latitude, :longitude => @longitude}
    end
  end

  class Dummy < Base
    def update
      @latitude = 35.591642 + Random.rand(-0.1 .. 0.1)
      @longitude = 139.721732 + Random.rand(-0.1 .. 0.1)
    end
  end #class Dummy
end #module GPS

opt = OptionParser.new
OPTS = {}
OPTS[:config] = "config.json"
OPTS[:debug] = false
OPTS[:times] = 10
OPTS[:interval] = 5
OPTS[:command] = "echo $value"

opt.on('-p', '--config=path', 'Config file path (default: .config.json)') {|v| OPTS[:config] = v}
opt.on('-d', '--debug', 'Enable debug message') {|v| OPTS[:debug] = v}
opt.on('-t', '--times=TIMES', 'Number of repeat times, -1 means infinite loop (default: 10)') {|v| OPTS[:times] = v.to_i}
opt.on('-i', '--interval=INTERVAL', 'Interval between sending a message (default: 5[sec])') {|v| OPTS[:interval] = v.to_i}
opt.on('-c', '--command=COMMAND', 'Command which execute push notification (default: echo $value)') {|v| OPTS[:command] = v}

opt.parse!(ARGV)

logger = Logger.new(STDOUT)
if (OPTS[:debug])
  logger.level = Logger::DEBUG
else
  logger.level = Logger::INFO
end
PusherClient.logger = logger

begin
  config = open(OPTS[:config]) do |io|
    JSON.load(io)
  end

  keys = ["host", "user", "password", "token",
          "pusher_key", "pusher_secret"]
  keys.each do |key|
    raise "Please specify '#{key}'" if !config[key]
  end
rescue => e
  logger.error("config file parse failed: #{e.message}")
  exit 1
end

if File.readable?(SYS_ETH0_MACADDR)
  uid = File.read(SYS_ETH0_MACADDR).chomp.gsub(':','')
else
  logger.warn("Unable to get MAC Address from #{SYS_ETH0_MACADDR}: Using random value instead")
  uid = SecureRandom.hex(6)
end

logger.info("uid: #{uid}")
logger.info("top page: #{config["host"]}")
logger.info("personal page: #{config["host"]}/cockpit?uid=#{uid}")

temp = TemperatureSensors.new
gps = GPS::Dummy.new
logger.info("Searching GPS...")
gps.update()

pusher_options = {:secret => config['pusher_secret']}
socket = PusherClient::Socket.new(config['pusher_key'],
                                  pusher_options)
socket.connect(true)
socket.subscribe(uid)

socket[uid].bind('button') do |data|
  d = JSON.parse(data)
  command = sprintf("value=%s;%s", d["value"], OPTS[:command])
  system(command)
end

site = RestClient::Resource.new(config["host"],
                                :user => config["user"],
                                :password => config["password"])
begin
  loops = 0
  loop do
    break if (0 <= OPTS[:times]) && (OPTS[:times] <= loops)

    sleep OPTS[:interval]

    created_at = Time.now.strftime("%Y-%m-%d %H:%M:%S")

    logger.info("#{loops}: #{created_at}")
    site['api/series'].post :value => temp.value,
    :uid => uid, :created_at => created_at, :token => config["token"],
    :latitude => gps.location[:latitude],
    :longitude => gps.location[:longitude]

    loops += 1
  end
rescue => e
  logger.error("oops: #{e.message}")
end
